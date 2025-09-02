# Proofreader API Explainer

*This proposal is an early design sketch by ODML and Chrome built-in AI team to describe the problem below and solicit
feedback on the proposed solution. It has not been approved to ship in Chrome.*

Proofreading is the process of examining a text carefully to find and correct errors such as grammar, spelling, and punctuation to generate an error-free text before it is published or shared. Browsers and operating systems are increasingly offering proofreading capability to help their users compose (examples: [Oodles of improvements to Chrome's Spell Checking](https://chrome.googleblog.com/2013/03/oodles-of-improvements-to-chromes-spell.html), [Use Writing Tools with Apple Intelligence on Mac](https://support.apple.com/guide/mac-help/use-writing-tools-mchldcd6c260/mac)).

Web applications can also benefit from such proofreading capability. This proposal introduces a new JavaScript API which, by exposing high-level functionality of a language model, corrects and labels a variety of errors from user input. Specifically, the proposed proofreading API in this explainer exposes three specific higher-level functionalities for proofreading:


1. Error Correction: Correct input text by the user
2. Error Labeling: For each correction made to each error in the input text, label the error type (e.g. spelling, punctuation, etc.)
3. Error Explanation: Annotates each error with a plain language explanation

Note that Labeling & Explanation are independent features that can be either added or dropped.

## Goals

Our goals are to:

* Help web developers perform real-time proofreading (e.g. of user input) on short phrases/sentences/paragraphs of freeform text.
* Allow web developers to build flexible proofreading UI/UX.
* Offer higher-level APIs with specific inputs and output formats that can support error labeling and explanations, abstracting away the underlying implementation (e.g. OS feature, language model, etc.).
* Enable progressive enhancement, so web developers can gracefully handle varying levels of user agent support.

The following are explicit non-goals:

* Proofreading for markdown or other formats/syntaxes (e.g. not intended for JS code)
* Check for consistent style and formatting throughout a user-provided input

## Use cases

* Proofread and suggest corrections to user messages in chat applications
* Proofread and help polish email drafting
* Catch errors and provide corrections during note-taking
* Proofread a comment to a forum/article/blog
* Provide high-quality interactive proofreading, along with labeling & explanations for the correction when writing documents

## Examples

### Basic usage
Create a proofreader object customized as necessary, and call its method to proofread an input:

```js
const proofreader = await Proofreader.create({
  includeCorrectionTypes: true,
  includeCorrectionExplanations: true,
});

const corrections = await proofreader.proofread("I seen him yesterday at the store, and he bought two loafs of bread.");
```

`proofread()` corrects the input text and returns a list of corrections made. Additional proofreading features can be configured using includeCorrectionTypes and `includeCorrectionExplanations`. When `includeCorrectionTypes` is set to `true`, `proofread()` will provide an error type label for each correction made to each error. When `includeCorrectionExplanations` is set to `true`, `proofread()` will provide an annotation for each error with a plain language explanation.

Detailed design for the corrections output is [discussed later](#proofreading-correction-output).

### Repeated usage

A created proofreader object can be used multiple times. **The only shared state is the initial configuration options**; the inputs do not build on each other.

```js
const proofreader = await Proofreader.create();

editBoxEl.addEventListener("blur", async (event) => {
  const corrections = await proofreader.proofread(event.target.value);
});
```

### Expected input languages

The default behavior for the proofreader object assumes that the input language is unknown. In this case, implementations will use whatever "base" capabilities they have available for these operations, and might throw "`NotSupportedError`" `DOMExceptions` if they encounter languages they don't support.

It’s better practice, if possible, to supply the `create()` method with information about the expected languages in use. This allows the implementation to download any necessary supporting material, such as fine-tunings or safety-checking models, and to immediately reject the promise returned by `create()` if the web developer wants to use languages that the browser is not capable of supporting:

```js
const proofreader = await Proofreader.create({
  includeCorrectionTypes: true,
  expectedInputLanguages: ["en"],
});
```

### Expected explanation language

When explanations for corrections are requested for the proofreading result, the default behavior for the proofreader object assumes that the explanation language is unknown and will be the same as the input language.

Similar to input languages, it’s better practice, if possible, to supply the `create()` method with the expected explanation languages.

```js
const proofreader = await Proofreader.create({
  includeCorrectionExplanations: true,
  expectedInputLanguagues: ["en"],
  correctionExplanationLanguage: "en",
});
```

### Multilingual content
When there are multiple languages in the proofreading input, developers could specify them by adding to the list of `expectedInputLanguages` in the `create()` method.

```js
const proofreader = await Proofreader.create({
  includeCorrectionTypes: true,
  expectedInputLanguages: ["en", "ja"],
});
```

### Testing available options before creation
The proofreading API is customizable during the `create()` calls, with various options including the language option above. All options are given in more detail in the [later section](#full-api-surface-in-web-idl).

However, not all models will necessarily support every language, and it might require a download to get the appropriate fine-tuning or other collateral necessary on the first use.

In the simple case, web developers should call `create()`, and handle failures gracefully. However, if they want to provide a differentiated user experience, which lets users know ahead of time that the feature will not be possible or might require a download, they can use the API’s promise-returning `availability()` method. This method lets developers know, before calling `create()`, what is possible with the implementation.

The method will return a promise that fulfills with one of the following availability values:
“`unavailable`” means that the implementation does not support the requested options.
“`downloadable`” means that the implementation supports the requested options, but it will have to download something (e.g. a machine learning model or fine-tuning) before it can do anything.
“`downloading`” means that the implementation supports the requested options, but it will have to finish an ongoing download before it can do anything.
“`available`” means that the implementation supports the requested options without requiring any new downloads.

An example usage is the following:

```js
const options = { includeCorrectionTypes: true, expectedInputLanguages: ["en"] };

const supportsOurUseCase = await Proofreader.availability(options);

if (supportsOurUseCase !== "unavailable") {
  // We're good! Let's do the proofreading using the built-in API.
  if (supportsOurUseCase !== "available") {
    console.log("Sit tight, we need to do some downloading...");
  }
  const proofreader = await Proofreader.create(options);
  console.log(await proofreader.proofread(editBoxEl.textContent));
} else {
  // Either the API overall, or the combination of correction-with-labels with
  // English input, is not available.
  // Handle the failure / run alternatives.
}
```

### Download progress
For cases where using the API is only possible after a download, you can monitor the download progress (e.g. in order to show your users a progress bar) using code such as the following:

```js
const proofreader = await Proofreader.create({
  ...otherOptions,
  monitor(m) {
    m.addEventListener("downloadprogress", e => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  }
});
```

If the download fails, then `downloadprogress` events will stop being fired, and the promise returned by `create()` will be rejected with a "`NetworkError`" `DOMException`.

Note that some implementations might require multiple entities to be downloaded, e.g. a base model plus a LoRA fine-tuning. In such a case, web developers do not get the ability to monitor the individual downloads. All of them are bundled into the overall `downloadprogress` events, and the `create()` promise is not fulfilled until all downloads and loads are successful.

### Destruction and aborting

The API comes equipped with a couple of `signal` options that accept `AbortSignal`s, to allow aborting the creation of the proofreader, or the operations themselves:

```js
const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const proofreader = await Proofreader.create({ signal: controller.signal });
await proofreader.proofread(document.body.textContent, { signal: controller.signal });
```

Additionally, the proofreader object itself has a `destroy()` method, which is a convenience method with equivalent behavior for cases where the proofreader object has already been created.

Destroying a proofreader will:

Reject any ongoing operations (`proofread()`).
And, most importantly, allow the user agent to unload the machine learning models from memory. (If no other APIs are using them.)
Allowing such destruction provides a way to free up the memory used by the language model without waiting for garbage collection, since models can be quite large.

Aborting the creation process will reject the promise returned by `create()`, and will also stop signaling any ongoing download progress. (The browser may then abort the downloads, or may continue them. Either way, no further `downloadprogress` events will be fired.)

## Detailed design discussion

### Proofreading correction output

For each input, the method `proofread()` returns a promise of `ProofreadResult`:

```idl
dictionary ProofreadResult {
  DOMString corrected;
  sequence<ProofreadCorrection> corrections;
}
```

`corrected` is the fully corrected version of the input, while `corrections` contains a list of corrections made, their locations in the original input (e.g. so web developers can create UI to highlight the error), and optionally labels/explanations.

```idl
dictionary ProofreadCorrection {
  unsigned long long startIndex;
  unsigned long long endIndex;
  DOMString correction;
  CorrectionType type; // exists if proofreader.includeCorrectionTypes === true
  DOMString explanation; // exists if proofreader.includeCorrectionExplanations === true
}

enum CorrectionType { "spelling", "punctuation", "capitalization", "preposition", "missing-words", "grammar" };
```

`type` only exists when the proofreader object is configured with `includeCorrectionTypes = true`, while `explanation` only exists when the proofreader object is configured with `includeCorrectionExplanations = true`.

Not all correction types here will be applicable to all languages, and in the future we might propose more specific correction types. The generic catch-all type, if no more-specific type matches, is `"grammar"`.

To get an error in the input, use `input.substring(startIndex, endIndex)`. Corrections in the `corrections` list will be organized in ascending order based on the `startIndex` of the correction.

Example usage of the output to highlight an error in input:

```js
let inputRenderIndex = 0;

for (const correction of corrections) {
  // Render part of input that has no error.
  if (correction.startIndex > inputRenderIndex) {
    const unchangedInput = document.createElement('span');
    unchangedInput.textContent = input.substring(inputRenderIndex, correction.startIndex);
    editBox.append(unchangedInput);
  }
  // Render part of input that has an error and highlight as such.
  const errorInput = document.createElement('span');
  errorInput.textContent = input.substring(correction.startIndex, correction.endIndex);
  errorInput.classList.add('error');
  editBox.append(errorInput);
  inputRenderIndex = correction.endIndex;
}

// Render the rest of the input that has no error.
if (inputRenderIndex !== input.length){
  const unchangedInput = document.createElement('span');
  unchangedInput.textContent = input.substring(inputRenderIndex, input.length);
  editBox.append(unchangedInput);
}
```

### Full API surface in Web IDL
```idl
[Exposed=(Window,Worker), SecureContext]
interface Proofreader {
  static Promise<Proofreader> create(optional ProofreaderCreateOptions options = {});
  static Promise<AIAvailability> availability(optional ProofreaderCreateCoreOptions options = {});

  Promise<ProofreadResult> proofread(
    DOMString input,
    optional ProofreaderProofreadOptions options = {}
  );
  ReadableStream proofreadStreaming(
    DOMString input,
    optional ProofreaderProofreadOptions options = {}
  );

  // whether to provide correction types for each correction as part of the proofreading result.
  readonly attribute boolean includeCorrectionTypes;
  // whether to provide explanations for each correction as part of the proofreading result.
  readonly attribute boolean includeCorrectionExplanations;
  readonly attribute DOMString? correctionExplanationLanguage;
  readonly attribute FrozenArray<DOMString>? expectedInputLanguages;

  undefined destroy();
};

dictionary ProofreaderCreateCoreOptions {
  boolean includeCorrectionTypes = false;
  boolean includeCorrectionExplanations = false;
  DOMString correctionExplanationLanguage;
  sequence<DOMString> expectedInputLanguages;
};

dictionary ProofreaderCreateOptions : ProofreaderCreateCoreOptions {
  AbortSignal signal;
  AICreateMonitorCallback monitor;
};

dictionary ProofreaderProofreadOptions {
  AbortSignal signal;
};

dictionary ProofreadResult {
  DOMString correctedInput;
  sequence<ProofreadCorrection> corrections;
};

dictionary ProofreadCorrection {
  unsigned long long startIndex;
  unsigned long long endIndex;
  DOMString correction;
  CorrectionType type;
  DOMString explanation;
};

enum CorrectionType {
  "spelling",
  "punctuation",
  "capitalization",
  "preposition",
  "missing-words",
  "grammar"
};
```

## Alternatives considered and under consideration

### Provide explanations only asynchronously
To offer a more comprehensive proofreading API, in addition to labeling the error type for each correction made, we considered annotating each correction with an explanation. Users of such proofreading capability can benefit from it to improve their writing skills.

However, due to technical limitations of the on-device language model, generating a short explanation for each correction takes significantly longer than real-time, not to mention multiple explanations for all corrections within a short sentence/paragraph.

To address this, we propose to only offer **streaming explanations** asynchronously from the list of corrections (ProofreadCorrection) through a streaming API. Specifically, instead of returning explanations for all corrections at one time, we would return one correction’s explanation at a time as they become available. This way, web developers can provide sooner UI updates to the users to make the experience less jarring.

### Interaction with other browser-integrated proofreading features

As web developers implement UX around this proofreading API, if users’ browser supports other integrated proofreading features, the UX could get confusing with two features trying to help at once.

The [spellcheck](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/spellcheck) attribute from HTML available across browsers might help developers signal to the browser to turn off its integrated spelling check if it has one. For example, when `spellcheck` is set to `false`, no red underlines/squiggly lines will appear to indicate a spelling error.

For more sophisticated browser-integrated proofreading features, it’s an open question how to address the potential conflicts. For example, for browser extensions, one option is for web developers to detect the presence of certain extensions and then decide the behavior of their own proofreading feature.

### Customization with user-mutable dictionary
While the proposed Proofreading API corrects user input based on general knowledge, there could be cases where users would prefer to ignore correcting certain proper names, acronyms, etc. For example, the proposed [Dictionary API](https://github.com/Igalia/explainers/blob/main/document-local-dictionary/README.md) allows users to add and remove words from the browser’s custom dictionary to address special use cases.

The Proofreading API can potentially allow users to specify a custom dictionary and avoid correcting any words included in the dictionary.

However, in cases where ignoring certain words for correction could potentially change the meaning/structure of a sentence, it could be a bit tricky to proofread with pre-trained language models. Therefore, we are moving forward without integration with custom dictionaries until further exploration and evaluation are done. Nevertheless, we invite discussion of all of these APIs within the Web Machine Learning Community Group.

## Privacy considerations
This API follows the same structure as the Writing Assistance API, and thus shares the same privacy considerations as the Writing Assistance API. Please see [the specification](https://webmachinelearning.github.io/writing-assistance-apis/#privacy).

## Security considerations

This API also shares the same security considerations as the Writing Assistance API. Please see [the specification](https://webmachinelearning.github.io/writing-assistance-apis/#security).

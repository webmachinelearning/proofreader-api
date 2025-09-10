# MizZzA-r

![MizZzA-r Banner](MizZzA-r.png)

## Overview

MizZzA-r is a Mizar proof verification system with web interface capabilities. This tool provides formal mathematical verification using the Mizar system through a user-friendly web API.

## Features

- 🔍 **Mizar Verification**: Full compatibility with Mizar Mathematical Library (MML)
- 🌐 **REST API**: JSON-based API for seamless integration
- 📱 **PWA Support**: Progressive Web App with offline capabilities
- ⚡ **Fast Processing**: Optimized verification with timeout protection

## Technical Specifications

- **Theme Color**: Green (#4caf50)
- **Mizar Version**: 8.1.15 with MML 5.94.1493
- **API Framework**: Flask 3.0.3
- **Platform**: Cross-platform web application

## API Endpoints

### `POST /verify`
Verifies Mizar proofs via JSON API.

**Request:**
```json
{
  "code": "environ\n\nbegin\n\ntheorem T1: 1 = 1;\nproof\n  thus 1 = 1;\nend;"
}
```

**Response:**
```json
{
  "status": "success|failure|error",
  "errors": [{"line": 1, "character": 5, "message": "error description"}],
  "raw_output": "full verifier output"
}
```

## Related Tools

Part of the Mathematical Verification Ecosystem:
- **Mathematical Verifier**: Core mathematical proof checking
- **QuaNThoR**: Quantum theorem verification and reasoning

## License

This project is protected under dual licensing:

- **Educational Use**: [Educational Protection License (EPL-1.0)](../LICENSE-EDUCATIONAL)
- **Advanced Features**: [SCL-1.0](../LICENSE-SCL-1.0)

**EDUCATIONAL USE ONLY** - Commercial exploitation prohibited without explicit licensing agreement.
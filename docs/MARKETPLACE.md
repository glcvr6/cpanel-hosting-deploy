# Marketplace Submission Notes

## Project identity

**Name:** cPanel Hosting Deploy  
**Version:** 1.11.0  
**Author:** Gabrijel Baban  
**Repository:** https://github.com/glcvr6/cpanel-hosting-deploy

## Short description

Safe cPanel deployment and remote synchronization for Cursor. Detect local and remote changes, deploy only NEW and CHANGED files, detect conflicts, safely handle remote additions and deletions, and require explicit confirmation for destructive actions. Supports multiple connections, folder mappings, SHA-256 tracking, and secure credentials.

## Distribution requirements

The distributed package must not contain:

- customer credentials;
- cPanel API tokens;
- production mappings;
- private customer data;
- local state generated during testing.

## Release messaging

v1.11.0 should be presented accurately: Protection is implemented and configurable, while systematic real-world Protection testing is the next development phase. The project welcomes controlled community testing.

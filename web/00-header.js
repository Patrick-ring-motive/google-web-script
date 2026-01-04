/**
 * Google Web Script - Web API Polyfill for Google Apps Script
 * afsd
 * This library provides Web-standard APIs (fetch, Blob, Headers, Request, Response)
 * for use in Google Apps Script environment by wrapping Google's native services.
 * 
 * IMPORTANT: This library is SYNCHRONOUS, unlike browser fetch() which is Promise-based.
 * This is intentional because Google Apps Script's UrlFetchApp is synchronous,
 * and there's no benefit to wrapping it in Promises. This actually makes it easier
 * to use in Apps Script contexts where you typically want sequential execution.
 * 
 * The main challenge is balancing Web API standards with Google Apps Script quirks:
 * - UrlFetchApp expects plain JS objects for options, not specialized classes
 * - Built-in objects have hidden properties that throw when accessed
 * - No native Promise support in older Apps Script runtimes
 * - Different object inheritance patterns than browser JavaScript
 * 
 * @fileoverview Web API compatibility layer for Google Apps Script
 * @author Patrick Ring (Patrick-ring-motive)
 * @license Not specified
 */

// IIFE to avoid polluting global namespace while still exposing Web object
(() => {
    // Initialize the global Web namespace if it doesn't exist
    globalThis.Web = globalThis.Web || class Web {};


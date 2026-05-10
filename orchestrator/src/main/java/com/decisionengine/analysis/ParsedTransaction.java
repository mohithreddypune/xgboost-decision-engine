package com.decisionengine.analysis;

import com.decisionengine.model.Transaction;

/**
 * Internal representation of a row read from the uploaded file,
 * carrying its original 1-based row number for error reporting.
 */
public record ParsedTransaction(int rowNumber, Transaction txn) { }

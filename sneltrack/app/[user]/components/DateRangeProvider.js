"use client";

import { useState, createContext, useContext } from "react";
import DateRangeSelectorClient from "../projecten/[projectId]/DateRangeSelectorClient";

const DateRangeContext = createContext();

export function DateRangeProvider({ children }) {
  // Default to current week
  const [rangeType, setRangeType] = useState("week");
  const [referenceDate, setReferenceDate] = useState(new Date());

  const handleRangeChange = (newRangeType, newReferenceDate) => {
    setRangeType(newRangeType);
    setReferenceDate(newReferenceDate);
  };

  return (
    <DateRangeContext.Provider
      value={{ rangeType, referenceDate, handleRangeChange }}
    >
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRangeContext() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error(
      "useDateRangeContext must be used within DateRangeProvider"
    );
  }
  return context;
}

export function DateRangeSelector() {
  const { rangeType, referenceDate, handleRangeChange } = useDateRangeContext();
  return (
    <DateRangeSelectorClient
      rangeType={rangeType}
      referenceDate={referenceDate}
      onRangeChange={handleRangeChange}
    />
  );
}

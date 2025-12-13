"use client";

import { useState, createContext, useContext } from "react";
import DateRangeSelectorClient from "../projecten/[projectId]/DateRangeSelectorClient";
import CustomDateRangeSelectorClient from "./CustomDateRangeSelectorClient";

const DateRangeContext = createContext();

export function DateRangeProvider({ children }) {
  // Default to current week
  const [rangeType, setRangeType] = useState("week");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);

  // Filter state
  const [selectedProjectIds, setSelectedProjectIds] = useState([]); // Empty array = all selected
  const [billableFilter, setBillableFilter] = useState("billable"); // "billable" | "non-billable" | "both"
  const [includeExpenses, setIncludeExpenses] = useState(true);

  const handleRangeChange = (
    newRangeType,
    newReferenceDate,
    customStart,
    customEnd,
    filters
  ) => {
    setRangeType(newRangeType);
    setReferenceDate(newReferenceDate);
    // Store custom dates if provided
    if (customStart && customEnd) {
      setCustomStartDate(customStart);
      setCustomEndDate(customEnd);
    } else {
      setCustomStartDate(null);
      setCustomEndDate(null);
    }

    // Update filters if provided
    if (filters) {
      if (filters.selectedProjectIds !== undefined) {
        setSelectedProjectIds(filters.selectedProjectIds);
      }
      if (filters.billableFilter !== undefined) {
        setBillableFilter(filters.billableFilter);
      }
      if (filters.includeExpenses !== undefined) {
        setIncludeExpenses(filters.includeExpenses);
      }
    }
  };

  return (
    <DateRangeContext.Provider
      value={{
        rangeType,
        referenceDate,
        handleRangeChange,
        customStartDate,
        customEndDate,
        selectedProjectIds,
        billableFilter,
        includeExpenses,
      }}
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

export function CustomDateRangeSelector() {
  const {
    rangeType,
    referenceDate,
    handleRangeChange,
    customStartDate,
    customEndDate,
    selectedProjectIds,
    billableFilter,
    includeExpenses,
  } = useDateRangeContext();
  return (
    <CustomDateRangeSelectorClient
      rangeType={rangeType}
      referenceDate={referenceDate}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      selectedProjectIds={selectedProjectIds}
      billableFilter={billableFilter}
      includeExpenses={includeExpenses}
      onRangeChange={handleRangeChange}
    />
  );
}

"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Accordion = React.createContext<{
  activeValue: string | null;
  setActiveValue: (value: string | null) => void;
}>({ activeValue: null, setActiveValue: () => {} });

export function AccordionRoot({ 
  children, 
  className,
  defaultValue = null 
}: { 
  children: React.ReactNode; 
  className?: string;
  defaultValue?: string | null;
}) {
  const [activeValue, setActiveValue] = React.useState<string | null>(defaultValue);

  return (
    <Accordion.Provider value={{ activeValue, setActiveValue }}>
      <div className={cn("space-y-4", className)}>
        {children}
      </div>
    </Accordion.Provider>
  )
}

export function AccordionItem({ 
  value, 
  children, 
  className 
}: { 
  value: string; 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={cn("border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm", className)}>
      {children}
    </div>
  )
}

export function AccordionTrigger({ 
  children, 
  value,
  className 
}: { 
  children: React.ReactNode; 
  value: string;
  className?: string;
}) {
  const { activeValue, setActiveValue } = React.useContext(Accordion);
  const isOpen = activeValue === value;

  return (
    <button
      type="button"
      onClick={() => setActiveValue(isOpen ? null : value)}
      className={cn(
        "flex w-full items-center justify-between p-5 text-left font-medium transition-all hover:bg-slate-50",
        isOpen && "bg-slate-50/50",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn(
          "w-1.5 h-6 rounded-full transition-colors",
          isOpen ? "bg-slate-800" : "bg-slate-300"
        )}></span>
        <span className="text-lg text-slate-900">{children}</span>
      </div>
      <ChevronDown className={cn(
        "h-5 w-5 shrink-0 text-slate-500 transition-transform duration-300",
        isOpen && "rotate-180"
      )} />
    </button>
  )
}

export function AccordionContent({ 
  children, 
  value,
  className 
}: { 
  children: React.ReactNode; 
  value: string;
  className?: string;
}) {
  const { activeValue } = React.useContext(Accordion);
  const isOpen = activeValue === value;

  return (
    <div 
      className={cn(
        "grid transition-all duration-300 ease-in-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
        <div className={cn("p-5 pt-0", className)}>
          {children}
        </div>
      </div>
    </div>
  )
}

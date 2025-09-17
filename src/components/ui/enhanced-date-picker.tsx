import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { usePreferences } from "@/contexts/PreferencesContext"

interface EnhancedDatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function EnhancedDatePicker({ 
  date, 
  setDate, 
  placeholder = "DD/MM/AAAA",
  className 
}: EnhancedDatePickerProps) {
  const { t, language } = usePreferences()
  const [inputValue, setInputValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)

  // Update input value when date changes from calendar
  React.useEffect(() => {
    if (date) {
      const formatted = language === 'pt' 
        ? format(date, "dd/MM/yyyy")
        : format(date, "MM/dd/yyyy")
      setInputValue(formatted)
    } else {
      setInputValue("")
    }
  }, [date, language])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "") // Remove non-digits
    
    // Apply mask DD/MM/YYYY or MM/DD/YYYY based on language
    if (value.length >= 2) {
      value = value.substring(0, 2) + "/" + value.substring(2)
    }
    if (value.length >= 5) {
      value = value.substring(0, 5) + "/" + value.substring(5, 9)
    }
    
    setInputValue(value)

    // Try to parse the date when complete
    if (value.length === 10) {
      try {
        const dateFormat = language === 'pt' ? "dd/MM/yyyy" : "MM/dd/yyyy"
        const parsedDate = parse(value, dateFormat, new Date())
        
        if (isValid(parsedDate)) {
          // Additional validation for birth dates
          const currentYear = new Date().getFullYear()
          const birthYear = parsedDate.getFullYear()
          
          if (birthYear >= 1900 && birthYear <= currentYear) {
            setDate(parsedDate)
          }
        }
      } catch (error) {
        // Invalid date, don't update
      }
    }
  }

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    setIsOpen(false)
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="flex-1"
        maxLength={10}
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleCalendarSelect}
            initialFocus
            locale={language === 'pt' ? ptBR : undefined}
            disabled={(date) =>
              date > new Date() || date < new Date("1900-01-01")
            }
            captionLayout="dropdown-buttons"
            fromYear={1900}
            toYear={currentYear}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
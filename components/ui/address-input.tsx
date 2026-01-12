"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin } from "lucide-react"

interface AddressSuggestion {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

interface AddressInputProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
}

export function AddressInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  className = "",
  required = false,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const mockSuggestions = [
    {
      place_id: "1",
      description: "123 Main Street, Beverly Hills, CA 90210",
      structured_formatting: {
        main_text: "123 Main Street",
        secondary_text: "Beverly Hills, CA 90210",
      },
    },
    {
      place_id: "2",
      description: "456 Oak Avenue, Manhattan Beach, CA 90266",
      structured_formatting: {
        main_text: "456 Oak Avenue",
        secondary_text: "Manhattan Beach, CA 90266",
      },
    },
    {
      place_id: "3",
      description: "789 Pine Road, Santa Monica, CA 90401",
      structured_formatting: {
        main_text: "789 Pine Road",
        secondary_text: "Santa Monica, CA 90401",
      },
    },
    {
      place_id: "4",
      description: "1109 G Ave, Plano, TX 75074",
      structured_formatting: {
        main_text: "1109 G Ave",
        secondary_text: "Plano, TX 75074",
      },
    },
    {
      place_id: "5",
      description: "2500 Victory Ave, Dallas, TX 75219",
      structured_formatting: {
        main_text: "2500 Victory Ave",
        secondary_text: "Dallas, TX 75219",
      },
    },
    {
      place_id: "6",
      description: "100 Congress Ave, Austin, TX 78701",
      structured_formatting: {
        main_text: "100 Congress Ave",
        secondary_text: "Austin, TX 78701",
      },
    },
    {
      place_id: "7",
      description: "500 Main St, Houston, TX 77002",
      structured_formatting: {
        main_text: "500 Main St",
        secondary_text: "Houston, TX 77002",
      },
    },
    {
      place_id: "8",
      description: "1 Infinite Loop, Cupertino, CA 95014",
      structured_formatting: {
        main_text: "1 Infinite Loop",
        secondary_text: "Cupertino, CA 95014",
      },
    },
  ]

  const fetchSuggestions = async (input: string) => {
    if (input.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Filter mock suggestions based on input
    const filtered = mockSuggestions.filter((suggestion) =>
      suggestion.description.toLowerCase().includes(input.toLowerCase()),
    )

    if (filtered.length === 0 && input.length >= 3) {
      const dynamicSuggestion = {
        place_id: "dynamic",
        description: input,
        structured_formatting: {
          main_text: input,
          secondary_text: "Custom address",
        },
      }
      setSuggestions([dynamicSuggestion])
    } else {
      setSuggestions(filtered)
    }

    setIsLoading(false)
    setShowSuggestions(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce the API call
    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 300)
  }

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.description)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false)
    }, 200)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="space-y-2 relative">
      <Label htmlFor={id} className="text-foreground">
        {label} {required && "*"}
      </Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`bg-input border-border text-foreground focus:border-primary pl-10 ${className}`}
          required={required}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-muted focus:bg-muted focus:outline-none border-b border-border last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-start space-x-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {suggestion.structured_formatting.main_text}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.structured_formatting.secondary_text}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

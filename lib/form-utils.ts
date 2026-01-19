import { ControllerRenderProps } from "react-hook-form"

export function numberInputProps(
  field: ControllerRenderProps<any, any>
) {
  return {
    value: field.value ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      field.onChange(e.target.value),
  }
}

export function dateInputProps(field: ControllerRenderProps<any, any>) {
  // RHF might give unknown, we coerce to Date | undefined
  const value = field.value instanceof Date ? field.value : undefined
  return {
    value,
    onChange: field.onChange,
  }
}
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';
import { TextField, type TextFieldProps } from './TextField';

/** Text field for shekel amounts. Parse the value with `parseMoneyToMinor` from shared. */
export const MoneyField = forwardRef<TextInput, Omit<TextFieldProps, 'keyboardType' | 'suffix'>>(
  function MoneyField(props, ref) {
    return (
      <TextField
        ref={ref}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="0"
        suffix="₪"
        maxLength={16}
        {...props}
      />
    );
  },
);

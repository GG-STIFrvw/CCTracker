import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const cardSchema = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  nickname: z.string().min(1, 'Card nickname is required'),
  cardholder_name: z.string().min(1, 'Cardholder name is required'),
  expiry_display: z.string().regex(/^\d{2}\/\d{2}$/, 'Format must be MM/YY'),
  mock_last4: z
    .string()
    .length(4, 'Must be exactly 4 digits')
    .regex(/^\d{4}$/, 'Digits only'),
  spending_limit: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .positive('Must be greater than 0'),
  color_primary: z.string().min(1),
  color_secondary: z.string().min(1),
})

export const transactionSchema = z.object({
  transaction_date: z.string().min(1, 'Date is required'),
  amount: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .positive('Amount must be greater than 0'),
  payment_due_date: z.string().optional(),
  notes: z.string().optional(),
})

export const paymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .positive('Amount must be greater than 0'),
  notes: z.string().optional(),
})

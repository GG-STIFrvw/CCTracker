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

export const borrowerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email address'),
})

export const loanSchema = z
  .object({
    amount: z.coerce
      .number({ invalid_type_error: 'Must be a number' })
      .positive('Amount must be greater than 0'),
    loan_date: z.string().min(1, 'Loan date is required'),
    description: z.string().optional(),
    payment_frequency: z.enum(['one-time', 'weekly', 'monthly']),
    payment_day: z.coerce.number().optional().nullable(),
    next_payment_date: z.string().optional().nullable(),
    notarized: z.boolean().default(false),
    lawyer_name: z.string().optional().nullable(),
    ptr_number: z.string().optional().nullable(),
    date_notarized: z.string().optional().nullable(),
    // Interest fields
    interest_bearing: z.boolean().default(false),
    minimum_payment: z.coerce.number().positive().optional().nullable(),
    interest_rate: z.coerce.number().min(0).optional().nullable(),
    interest_type: z.enum(['simple', 'diminishing']).optional().nullable(),
    late_fee_rate: z.coerce.number().min(0).optional().nullable(),
    penalty_rate: z.coerce.number().min(0).optional().nullable(),
  })
  .refine(
    (d) => {
      if (d.payment_frequency === 'monthly') {
        return d.payment_day === 15 || d.payment_day === 30
      }
      return true
    },
    { message: 'Payment day must be 15 or 30 for monthly frequency', path: ['payment_day'] }
  )
  .refine(
    (d) => {
      if (d.notarized) {
        return !!d.lawyer_name && !!d.ptr_number && !!d.date_notarized
      }
      return true
    },
    { message: 'Lawyer name, PTR number, and date notarized are required when notarized', path: ['lawyer_name'] }
  )
  .refine(
    (d) => {
      if (d.interest_bearing) {
        return d.interest_rate != null && !!d.interest_type
      }
      return true
    },
    { message: 'Interest rate and type are required when interest is enabled', path: ['interest_rate'] }
  )

export const loanPaymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .positive('Amount must be greater than 0'),
  notes: z.string().optional(),
})

export const expenseSchema = z.object({
  expense_date: z.string().min(1, 'Date is required'),
  category: z.enum([
    'utilities','food','transportation','rent','healthcare',
    'shopping','entertainment','subscriptions','education',
    'personal_care','insurance','others',
  ], { required_error: 'Category is required' }),
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .positive('Amount must be greater than 0'),
  payment_method: z.enum(
    ['cash','gcash','maya','bank_transfer','others'],
    { required_error: 'Payment method is required' }
  ),
  notes: z.string().optional(),
})

export const billingCycleSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
}).refine(d => d.end_date >= d.start_date, {
  message: 'End date must be on or after start date',
  path: ['end_date'],
})

export const loanInterestRateSchema = z.object({
  interest_rate: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .min(0, 'Must be 0 or greater'),
  interest_type: z.enum(['simple', 'diminishing'], { required_error: 'Interest type is required' }),
  late_fee_rate: z.coerce.number().min(0, 'Must be 0 or greater'),
  penalty_rate: z.coerce.number().min(0, 'Must be 0 or greater'),
  effective_from: z.string().min(1, 'Effective date is required'),
})

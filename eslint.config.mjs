import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: import.meta.url,
})

const config = [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },
]

export default config

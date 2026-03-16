import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import './kosmos-tokens.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

// Set NEXT_PUBLIC_KOSMOS=1 in .env.local to enable Kosmos design token alignment.
// Applies Kmart brand tokens (AnkoModerat typeface, neutralGrey colour scale,
// Kosmos spacing/radius values) via [data-theme="kosmos"] CSS overrides.
// Remove or unset the flag to revert to the original Kurator styling.
const useKosmos = process.env.NEXT_PUBLIC_KOSMOS === '1'

export const metadata: Metadata = {
  title: 'Kmart Kurator',
  description: 'Find the perfect outfit, home look, kitchen set or party pack — powered by Kmart.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" {...(useKosmos ? { 'data-theme': 'kosmos' } : {})}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
      </head>
      <body className={dmSans.variable}>{children}</body>
    </html>
  )
}

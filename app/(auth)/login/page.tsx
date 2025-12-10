'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for auth error from URL params (e.g., Taihu auth failure)
  useEffect(() => {
    const authError = searchParams.get('error')
    if (authError) {
      setError(authError)
      // Clean up URL without triggering navigation
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      router.push('/')
    }
  }

  function handleTaihuLogin() {
    // Redirect to Taihu SSO - the proxy.ts will handle the authentication
    // For now, just redirect to home and let proxy handle Taihu headers
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex gradient-bg-animated">
      {/* Left Side - Branding/Visual Area */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Pattern - Network Graph */}
        <div className="absolute inset-0">
          {/* Soft glowing background effects */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
          
          {/* Network Graph SVG - Subtle & Elegant */}
          <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
            <defs>
              {/* Subtle gradient for lines */}
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(148, 163, 184, 0.3)" />
                <stop offset="100%" stopColor="rgba(148, 163, 184, 0.1)" />
              </linearGradient>
              {/* Soft glow filter */}
              <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Connection Lines - Thin and subtle */}
            <g stroke="url(#lineGradient)" strokeWidth="0.5" fill="none">
              {/* Main structure */}
              <line x1="400" y1="380" x2="220" y2="220" />
              <line x1="400" y1="380" x2="580" y2="220" />
              <line x1="400" y1="380" x2="180" y2="420" />
              <line x1="400" y1="380" x2="620" y2="480" />
              <line x1="400" y1="380" x2="320" y2="580" />
              <line x1="400" y1="380" x2="520" y2="620" />
              
              {/* Extended connections */}
              <line x1="220" y1="220" x2="120" y2="160" />
              <line x1="220" y1="220" x2="280" y2="140" />
              <line x1="580" y1="220" x2="680" y2="160" />
              <line x1="580" y1="220" x2="520" y2="120" />
              <line x1="180" y1="420" x2="100" y2="360" />
              <line x1="180" y1="420" x2="120" y2="520" />
              <line x1="620" y1="480" x2="700" y2="420" />
              <line x1="620" y1="480" x2="680" y2="580" />
              <line x1="320" y1="580" x2="240" y2="660" />
              <line x1="520" y1="620" x2="580" y2="720" />
              
              {/* Cross connections - very subtle */}
              <line x1="220" y1="220" x2="580" y2="220" opacity="0.3" />
              <line x1="220" y1="220" x2="180" y2="420" opacity="0.3" />
              <line x1="580" y1="220" x2="620" y2="480" opacity="0.3" />
              <line x1="320" y1="580" x2="520" y2="620" opacity="0.3" />
            </g>
            
            {/* Primary Nodes - Central hub */}
            <g filter="url(#softGlow)">
              <circle cx="400" cy="380" r="6" fill="rgba(148, 163, 184, 0.4)" />
              <circle cx="400" cy="380" r="3" fill="rgba(203, 213, 225, 0.6)" />
            </g>
            
            {/* Secondary Nodes */}
            <g opacity="0.5">
              <circle cx="220" cy="220" r="4" fill="rgba(148, 163, 184, 0.5)" />
              <circle cx="220" cy="220" r="2" fill="rgba(203, 213, 225, 0.4)" />
              
              <circle cx="580" cy="220" r="4" fill="rgba(148, 163, 184, 0.5)" />
              <circle cx="580" cy="220" r="2" fill="rgba(203, 213, 225, 0.4)" />
              
              <circle cx="180" cy="420" r="4" fill="rgba(148, 163, 184, 0.5)" />
              <circle cx="180" cy="420" r="2" fill="rgba(203, 213, 225, 0.4)" />
              
              <circle cx="620" cy="480" r="4" fill="rgba(148, 163, 184, 0.5)" />
              <circle cx="620" cy="480" r="2" fill="rgba(203, 213, 225, 0.4)" />
              
              <circle cx="320" cy="580" r="4" fill="rgba(148, 163, 184, 0.5)" />
              <circle cx="320" cy="580" r="2" fill="rgba(203, 213, 225, 0.4)" />
              
              <circle cx="520" cy="620" r="4" fill="rgba(148, 163, 184, 0.5)" />
              <circle cx="520" cy="620" r="2" fill="rgba(203, 213, 225, 0.4)" />
            </g>
            
            {/* Tertiary Nodes - Small endpoints */}
            <g opacity="0.35">
              <circle cx="120" cy="160" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="280" cy="140" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="680" cy="160" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="520" cy="120" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="100" cy="360" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="120" cy="520" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="700" cy="420" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="680" cy="580" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="240" cy="660" r="2" fill="rgba(148, 163, 184, 0.6)" />
              <circle cx="580" cy="720" r="2" fill="rgba(148, 163, 184, 0.6)" />
            </g>
            
            {/* Subtle floating dots */}
            <g opacity="0.15">
              <circle cx="300" cy="300" r="1.5" fill="white" />
              <circle cx="500" cy="350" r="1.5" fill="white" />
              <circle cx="350" cy="480" r="1.5" fill="white" />
              <circle cx="450" cy="520" r="1.5" fill="white" />
              <circle cx="260" cy="400" r="1.5" fill="white" />
              <circle cx="540" cy="400" r="1.5" fill="white" />
            </g>
          </svg>
        </div>

          {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center glow-blue">
              <span className="text-white font-bold text-lg">IT</span>
            </div>
            <span className="text-2xl font-bold text-gradient">IT Aware</span>
          </div>

          {/* Tagline */}
          <div className="mb-24">
            <h1 className="text-5xl font-bold leading-tight mb-4">
              <span className="text-gradient">INTELLIGENT</span>
              <br />
              <span className="brand-text-primary">IT AWARENESS</span>
              <br />
              <span className="brand-text-secondary">Cross Platforms</span>
            </h1>
            <p className="brand-text-secondary text-lg mt-6">
              Persona, Journey, Feeds, Context
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md glass-card rounded-2xl p-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center glow-blue">
              <span className="text-white font-bold text-lg">IT</span>
            </div>
            <span className="text-2xl font-bold text-gradient">IT Aware</span>
          </div>

          <h2 className="text-3xl font-bold theme-text-primary mb-2">Welcome Back</h2>
          <p className="theme-text-secondary mb-8">Sign in to access your dashboard</p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm theme-text-primary">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-base font-semibold theme-text-label mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                required
                className="w-full px-4 py-3 theme-input rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-base font-semibold theme-text-label mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full px-4 py-3 theme-input rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 btn-glass text-white font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t theme-border-subtle" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent theme-text-muted">OR</span>
            </div>
          </div>

          {/* SSO Options */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleTaihuLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 btn-glass-outline theme-text-primary rounded-lg border theme-border"
            >
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="font-medium">Sign in with Taihu</span>
            </button>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-sm theme-text-muted">
            Need help? Contact{' '}
            <a href="mailto:support@itaware.com" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
              support@itaware.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

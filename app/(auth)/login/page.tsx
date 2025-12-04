'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        {/* Background Pattern */}
        <div className="absolute inset-0">
          {/* Glowing orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl" />
          
          {/* Circular outlines */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 border border-white/10 rounded-full" />
          <div className="absolute top-1/3 left-1/3 w-64 h-64 border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-cyan-400/20 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full" />
        </div>
        
        {/* Grid Lines */}
        <div className="absolute inset-0 opacity-[0.03]">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute h-px w-full bg-white" style={{ top: `${i * 5}%` }} />
          ))}
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute w-px h-full bg-white" style={{ left: `${i * 5}%` }} />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center glow-blue">
              <span className="text-white font-bold text-lg">IT</span>
            </div>
            <span className="text-2xl font-bold">IT Aware</span>
          </div>

          {/* Tagline */}
          <div className="mb-24">
            <h1 className="text-5xl font-bold leading-tight mb-4">
              <span className="text-gradient">INTELLIGENT</span>
              <br />
              <span className="text-white">IT DATA AWARENESS</span>
              <br />
              <span className="text-gray-400">PLATFORM</span>
            </h1>
            <p className="text-gray-400 text-lg mt-6">
              Unified visibility across your infrastructure
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
            <span className="text-2xl font-bold text-white">IT Aware</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400 mb-8">Sign in to access your dashboard</p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="remember"
                  className="w-4 h-4 bg-white/5 border-white/20 rounded focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="ml-2 text-sm text-gray-400">Remember me for 14 days</span>
              </label>
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
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-gray-500">OR</span>
            </div>
          </div>

          {/* SSO Options */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleTaihuLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 btn-glass-outline text-white rounded-lg"
            >
              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="font-medium">Sign in with Taihu</span>
            </button>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500">
            Need help? Contact{' '}
            <a href="mailto:support@itaware.com" className="text-blue-400 hover:text-blue-300 transition-colors">
              support@itaware.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

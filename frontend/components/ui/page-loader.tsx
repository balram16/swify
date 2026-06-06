"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"

// Define page-specific loading messages
const pageLoadingMessages = {
  "/dashboard/provider": [
    {
      message: "Loading your insurance dashboard...",
      icon: "📊"
    },
    {
      message: "Fetching latest claims data...",
      icon: "📋"
    },
    {
      message: "Analyzing fraud detection patterns...",
      icon: "🔍"
    },
    {
      message: "Updating risk assessment metrics...",
      icon: "📈"
    }
  ],
  "/dashboard/provider/claims": [
    {
      message: "Loading claims database...",
      icon: "📁"
    },
    {
      message: "Syncing records...",
      icon: "⛓️"
    },
    {
      message: "Running AI verification checks...",
      icon: "🤖"
    },
    {
      message: "Preparing claims overview...",
      icon: "📋"
    }
  ],
  "/dashboard/provider/policies": [
    {
      message: "Loading policy templates...",
      icon: "📝"
    },
    {
      message: "Updating coverage data...",
      icon: "🛡️"
    },
    {
      message: "Syncing premium calculations...",
      icon: "💰"
    },
    {
      message: "Preparing policy dashboard...",
      icon: "📊"
    }
  ],
  "/dashboard/provider/team": [
    {
      message: "Loading team analytics...",
      icon: "👥"
    },
    {
      message: "Syncing performance metrics...",
      icon: "📈"
    },
    {
      message: "Updating task assignments...",
      icon: "✅"
    },
    {
      message: "Preparing team overview...",
      icon: "👨‍💼"
    }
  ],
  "/onboarding/company": [
    {
      message: "Preparing your onboarding journey...",
      icon: "🚀"
    },
    {
      message: "Setting up integration...",
      icon: "⛓️"
    },
    {
      message: "Configuring AI models...",
      icon: "🤖"
    },
    {
      message: "Almost ready to transform your claims process...",
      icon: "✨"
    }
  ],
  "default": [
    {
      message: "Connecting securely...",
      icon: "🔒"
    },
    {
      message: "Loading Swift Claim platform...",
      icon: "⚡"
    },
    {
      message: "Preparing your experience...",
      icon: "✨"
    }
  ]
}

export function PageLoader() {
  const pathname = usePathname()
  const [currentMessage, setCurrentMessage] = useState(
    (pageLoadingMessages[pathname as keyof typeof pageLoadingMessages] || pageLoadingMessages.default)[0]
  )

  useEffect(() => {
    const messages = pageLoadingMessages[pathname as keyof typeof pageLoadingMessages] || pageLoadingMessages.default
    let currentIndex = 0

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length
      setCurrentMessage(messages[currentIndex])
    }, 2000)

    return () => clearInterval(interval)
  }, [pathname])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
      >
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <Image
            src="https://i.ibb.co/5Xn2hrY3/logo-white-bg.png"
            alt="Swift Claim"
            width={80}
            height={80}
            className="rounded-xl"
          />
          
          {/* Smooth Orange Loader Line */}
          <div className="relative w-32 h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-[#fa6724]"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: [0.4, 0, 0.6, 1], // Custom easing for smoother animation
                repeatType: "reverse"
              }}
            />
          </div>
          
          {/* Message */}
          <motion.div
            key={currentMessage.message}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-gray-600 dark:text-gray-300 font-medium text-center"
          >
            {currentMessage.message}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
} 
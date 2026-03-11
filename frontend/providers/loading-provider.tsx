"use client"

import { createContext, useContext, useState, useEffect, Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { PageLoader } from "@/components/ui/page-loader"

const LoadingContext = createContext({
  isLoading: false,
  setIsLoading: (loading: boolean) => {}
})

function LoadingListener({ setIsLoading }: { setIsLoading: (loading: boolean) => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => setIsLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [pathname, searchParams, setIsLoading])

  return null
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      <Suspense fallback={null}>
        <LoadingListener setIsLoading={setIsLoading} />
      </Suspense>
      {isLoading && <PageLoader />}
      {children}
    </LoadingContext.Provider>
  )
}

export const useLoading = () => useContext(LoadingContext) 
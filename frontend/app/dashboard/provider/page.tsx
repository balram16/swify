"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { WelcomeModal } from "@/components/provider/welcome-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Shield,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  MessageCircle,
  RefreshCw,
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function ProviderDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [showAssistant, setShowAssistant] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [assistantMood, setAssistantMood] = useState("happy")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [dashboardData, setDashboardData] = useState({
    metrics: {
      totalClaims: { count: 0, trend: "+0%", isPositive: true },
      pendingClaims: { count: 0, trend: "+0%", isPositive: true },
      fraudDetected: { count: 0, trend: "0%", isPositive: true },
      totalPolicies: { count: 0, trend: "+0%", isPositive: true }
    },
    recentClaims: [] as any[],
    fraudAlerts: [] as any[],
    performance: {
      averageProcessingTime: "N/A",
      automationRate: "0%",
      customerSatisfaction: "N/A",
      fraudPreventionSavings: "₹0"
    }
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [policiesRes, claimsRes] = await Promise.all([
        apiClient.get('/policies/provider/policies'),
        apiClient.get('/claims/provider') // Changed back to standard /claims/provider
      ])

      const policies = policiesRes.success && policiesRes.data ? policiesRes.data : []
      const claims = claimsRes.success && claimsRes.data ? claimsRes.data : []

      const totalPolicies = policies.length
      const totalClaims = claims.length
      const pendingClaims = claims.filter((c: any) => c.claim_status === 'pending' || c.claim_status === 'pending_provider_review').length

      const fraudAlerts: any[] = []
      let fraudDetectedCount = 0
      let totalClaimedAmount = 0
      let totalApprovedAmount = 0
      let totalFraudAmount = 0

      claims.forEach((c: any) => {
        let isFraud = false
        let riskLevel = 'Low'
        let fraudType = 'Unknown'
        let description = 'Suspicious activity detected'

        totalClaimedAmount += Number(c.claim_amount || 0)
        if (c.claim_status === 'approved') {
            totalApprovedAmount += Number(c.approved_amount || c.claim_amount || 0)
        }

        let ai = c.ai_analysis
        if (typeof ai === 'string') {
          try { ai = JSON.parse(ai) } catch (e) {}
        }

        if (ai) {
          if (ai.fraudScore > 70 || ai.riskLevel === 'High' || ai.riskLevel === 'high') {
            isFraud = true
            riskLevel = ai.riskLevel || 'High'
            fraudType = 'High Risk Claim'
            description = ai.summary || 'AI detected potential fraud.'
          }
        } else if (c.claim_status === 'rejected_by_ai') {
          isFraud = true
          riskLevel = 'High'
          fraudType = 'AI Rejected'
          description = 'Claim was automatically rejected by AI analysis.'
        }

        if (isFraud) {
          fraudDetectedCount++
          totalFraudAmount += Number(c.claim_amount || 0)
          fraudAlerts.push({
            id: `FRD-${c.claim_id}`,
            claimId: c.claim_id,
            type: fraudType,
            description: description,
            riskLevel: riskLevel,
            detectedAt: c.filing_date
          })
        }
      })

      const recentClaims = claims.slice(0, 5).map((c: any) => ({
        id: `CLM-${c.claim_id}`,
        dbId: c.claim_id,
        customerName: c.claimant_name || c.policyholder_name || 'Unknown',
        type: c.policy_type || 'Insurance',
        amount: `₹${parseFloat(c.claim_amount || 0).toLocaleString('en-IN')}`,
        status: c.claim_status === 'pending_provider_review' ? 'Under Review' : 
                c.claim_status === 'pending' ? 'Processing' :
                c.claim_status === 'approved' ? 'Approved' :
                c.claim_status === 'rejected' ? 'Rejected' : c.claim_status,
        riskScore: c.fraud_score || 0,
        submittedAt: c.filing_date
      }))

      setDashboardData({
        metrics: {
          totalClaims: { count: totalClaims, trend: "", isPositive: true },
          pendingClaims: { count: pendingClaims, trend: "", isPositive: true },
          fraudDetected: { count: fraudDetectedCount, trend: "", isPositive: false },
          totalPolicies: { count: totalPolicies, trend: "", isPositive: true }
        },
        recentClaims: recentClaims,
        fraudAlerts: fraudAlerts.slice(0, 5),
        performance: {
          averageProcessingTime: "24 hours", // Would require completion dates to calculate accurately
          automationRate: totalClaims > 0 ? `${Math.round((claims.filter((c: any) => c.ai_analysis).length / totalClaims) * 100)}%` : "0%",
          customerSatisfaction: "4.8/5", // Mock or from a feedback table
          fraudPreventionSavings: `₹${totalFraudAmount.toLocaleString('en-IN')}`
        }
      })

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Function to get Claim Saathi's expression based on context
  const getAssistantImage = (context: string) => {
    switch (context) {
      case "fraud":
        return "https://i.ibb.co/Z7MhTHj/claimsaathi-neutral-mildlyangry.png"
      case "success":
        return "https://i.ibb.co/DgLw71WX/claimsaathi-happy-tooexcited-smilingwithopenmouth.png"
      case "warning":
        return "https://i.ibb.co/ZRq6hPFn/claimsaathi-angry-shouting.png"
      case "chat":
        return "https://i.ibb.co/JFW8D5KV/claimsaathi-goodmood-happy.png"
      default:
        return "https://i.ibb.co/XZP3h1bN/claimsaathi-neutral-firm.png"
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {isNewUser && <WelcomeModal />}
      
      <div className="space-y-8 p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src={getAssistantImage(activeTab)}
              alt="Claim Saathi"
              width={48}
              height={48}
              className="rounded-full"
            />
            <div>
              <h1 className="text-3xl font-bold">Provider Dashboard</h1>
              <p className="text-muted-foreground">
                Monitor claims, detect fraud, and manage policies
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button 
              className="bg-[#07a6ec] hover:bg-[#0696d7]"
              onClick={() => setShowAssistant(true)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Ask Claim Saathi
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Claims</p>
                  <h3 className="text-2xl font-bold">{dashboardData.metrics.totalClaims.count}</h3>
                </div>
                <div className={`flex items-center ${
                  dashboardData.metrics.totalClaims.isPositive ? "text-green-500" : "text-red-500"
                }`}>
                  {dashboardData.metrics.totalClaims.isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span className="ml-1">{dashboardData.metrics.totalClaims.trend}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Claims</p>
                  <h3 className="text-2xl font-bold">{dashboardData.metrics.pendingClaims.count}</h3>
                </div>
                <div className={`flex items-center ${
                  dashboardData.metrics.pendingClaims.isPositive ? "text-green-500" : "text-red-500"
                }`}>
                  {dashboardData.metrics.pendingClaims.isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span className="ml-1">{dashboardData.metrics.pendingClaims.trend}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fraud Detected</p>
                  <h3 className="text-2xl font-bold">{dashboardData.metrics.fraudDetected.count}</h3>
                </div>
                <div className={`flex items-center ${
                  !dashboardData.metrics.fraudDetected.isPositive ? "text-green-500" : "text-red-500"
                }`}>
                  {!dashboardData.metrics.fraudDetected.isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span className="ml-1">{dashboardData.metrics.fraudDetected.trend}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Policies</p>
                  <h3 className="text-2xl font-bold">{dashboardData.metrics.totalPolicies.count}</h3>
                </div>
                <div className={`flex items-center ${
                  dashboardData.metrics.totalPolicies.isPositive ? "text-green-500" : "text-red-500"
                }`}>
                  {dashboardData.metrics.totalPolicies.isPositive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span className="ml-1">{dashboardData.metrics.totalPolicies.trend}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs 
          defaultValue="overview" 
          className="space-y-6"
          onValueChange={(value) => {
            setActiveTab(value)
            // Update Claim Saathi's expression based on tab
            if (value === "fraud") setAssistantMood("angry")
            else if (value === "performance") setAssistantMood("happy")
            else setAssistantMood("neutral")
          }}
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="claims">Claims</TabsTrigger>
            <TabsTrigger value="fraud">Fraud Detection</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Recent Claims */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.recentClaims.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No claims have been submitted yet.
                    </div>
                  ) : dashboardData.recentClaims.map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                        <div>
                          <p className="text-sm text-muted-foreground">Claim ID</p>
                          <p className="font-medium">{claim.id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Customer</p>
                          <p className="font-medium">{claim.customerName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Amount</p>
                          <p className="font-medium">{claim.amount}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <div className="flex items-center">
                            {claim.status === "Processing" && (
                              <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                            )}
                            {claim.status === "Approved" && (
                              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                            )}
                            {claim.status === "Under Review" && (
                              <AlertTriangle className="h-4 w-4 text-orange-500 mr-1" />
                            )}
                            {claim.status === "Rejected" && (
                              <XCircle className="h-4 w-4 text-red-500 mr-1" />
                            )}
                            <span>{claim.status}</span>
                          </div>
                        </div>
                      </div>
                      <Link href="/dashboard/provider/claims">
                        <Button variant="ghost">View Details</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fraud Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Fraud Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.fraudAlerts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No fraudulent claims detected recently. Great!
                    </div>
                  ) : dashboardData.fraudAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{alert.type}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            alert.riskLevel === "High" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {alert.riskLevel} Risk
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">{new Date(alert.detectedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                      <Link href="/dashboard/provider/claims">
                        <Button variant="outline">Investigate</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Processing Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Average Processing Time</p>
                      <span className="text-sm text-muted-foreground">{dashboardData.performance.averageProcessingTime}</span>
                    </div>
                    <Progress value={80} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Automation Rate (AI Screened)</p>
                      <span className="text-sm text-muted-foreground">{dashboardData.performance.automationRate}</span>
                    </div>
                    <Progress value={parseInt(dashboardData.performance.automationRate) || 0} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Impact & Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-[#07a6ec]">{dashboardData.performance.customerSatisfaction}</p>
                    <p className="text-sm text-muted-foreground">Average Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{dashboardData.performance.fraudPreventionSavings}</p>
                    <p className="text-sm text-muted-foreground">Fraud Prevention Savings (Flagged Amounts)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claims">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="text-xl font-medium">Manage All Claims</h3>
                <p className="text-muted-foreground">Review, approve, and reject claims in the dedicated claims management portal.</p>
                <Link href="/dashboard/provider/claims">
                  <Button className="bg-[#07a6ec] hover:bg-[#0696d7]">Go to Claims Management</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fraud">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="text-xl font-medium">Fraud Detection Center</h3>
                <p className="text-muted-foreground">Detailed fraud analytics and high-risk claim investigations will appear here.</p>
                <Link href="/dashboard/provider/claims?filter=fraud">
                  <Button variant="outline">Review High Risk Claims</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
        
        {/* Claim Saathi Assistant */}
        {showAssistant && (
          <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-80 z-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Image
                  src={getAssistantImage("chat")}
                  alt="Claim Saathi"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <span className="font-medium">Claim Saathi</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAssistant(false)}
              >
                ×
              </Button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 mb-3">
              <p className="text-sm">
                Hi! I'm here to help you manage your insurance operations. 
                What would you like to know?
              </p>
            </div>
            {/* Add chat interface here */}
          </div>
        )}
      </div>
    </>
  )
}
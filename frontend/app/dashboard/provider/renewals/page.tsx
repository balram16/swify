"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Download,
  CheckCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Calendar,
  RefreshCw,
  Brain,
  ArrowUpRight
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

export default function RenewalsPage() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [renewalsData, setRenewalsData] = useState({
    stats: {
      totalRenewals: 0,
      dueThisMonth: 0,
      dueNextMonth: 0,
      renewalRate: "0%",
      aiProcessed: "N/A"
    },
    upcomingRenewals: [] as any[],
    recentRenewals: [] as any[],
    renewalMetrics: {
      renewalRate: { thisMonth: "0%", lastMonth: "0%", growth: "0%" },
      averagePremiumIncrease: { thisMonth: "0%", lastMonth: "0%", growth: "0%" },
      aiProcessingRate: { thisMonth: "0%", lastMonth: "0%", growth: "0%" },
      renewalByType: {} as Record<string, any>
    }
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/policies/provider/policies')
      if (res.success && res.data) {
        const policies = res.data

        const upcoming: any[] = []
        let totalRenewalsCount = 0
        let dueThisMonthCount = 0
        let dueNextMonthCount = 0

        const now = new Date()
        const currentMonth = now.getMonth()
        const nextMonth = (currentMonth + 1) % 12

        policies.forEach((p: any) => {
          if (p.status === 'active' || p.status === 'pending') {
            const endDateStr = p.end_date || new Date(Date.now() + 86400000 * 30).toISOString()
            const endDate = new Date(endDateStr)
            
            const timeDiff = endDate.getTime() - now.getTime()
            const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))

            // Consider policies due within next 60 days as renewals
            if (daysRemaining <= 60 && daysRemaining >= -30) {
              totalRenewalsCount++

              if (endDate.getMonth() === currentMonth) {
                dueThisMonthCount++
              } else if (endDate.getMonth() === nextMonth) {
                dueNextMonthCount++
              }

              let status = "Due Soon"
              if (daysRemaining < 0) status = "Expired"
              else if (endDate.getMonth() === nextMonth) status = "Due Next Month"

              const currentPremium = parseFloat(p.premium_amount || 0)
              const newPremium = currentPremium * 1.05 // Mocking a 5% increase for renewal

              upcoming.push({
                id: `POL-${p.policy_number || p.policy_id}`,
                dbId: p.policy_id,
                customerName: p.holder_name || "Unknown",
                type: p.plan_name || "Insurance",
                currentPremium: `₹${currentPremium.toLocaleString('en-IN')}/year`,
                newPremium: `₹${newPremium.toLocaleString('en-IN')}/year`,
                premiumChange: "+5%",
                expiryDate: endDateStr,
                status: status,
                daysRemaining: daysRemaining,
                claimHistory: {
                  total: 0, // Mocked for now, would need a join to get exact
                  lastYear: 0
                },
                aiRecommendation: {
                  action: "Renew with Standard Terms",
                  confidence: 90,
                  reason: "Stable risk profile based on available data"
                }
              })
            }
          }
        })

        setRenewalsData(prev => ({
          ...prev,
          stats: {
            totalRenewals: totalRenewalsCount,
            dueThisMonth: dueThisMonthCount,
            dueNextMonth: dueNextMonthCount,
            renewalRate: "0%", // Needs historical data
            aiProcessed: "0%"
          },
          upcomingRenewals: upcoming,
          recentRenewals: [], // Would need historical renewed policies
          renewalMetrics: {
            ...prev.renewalMetrics,
            renewalByType: {
              "General": { rate: "0%", trend: "0%" }
            }
          }
        }))
      }
    } catch (error) {
      console.error("Error fetching renewals:", error)
      toast({ title: "Error", description: "Failed to load renewals data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])
  
  const toggleExpand = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id)
  }
  
  const filteredRenewals = renewalsData.upcomingRenewals.filter(renewal => {
    if (statusFilter !== "all" && !renewal.status.toLowerCase().includes(statusFilter.toLowerCase())) {
      return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        renewal.id.toLowerCase().includes(query) ||
        renewal.customerName.toLowerCase().includes(query) ||
        renewal.type.toLowerCase().includes(query)
      )
    }
    return true
  })
  
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "due soon":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{status}</Badge>
      case "due next month":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{status}</Badge>
      case "renewed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{status}</Badge>
      case "expired":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{status}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading renewals...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Policy Renewals</h1>
          <p className="text-muted-foreground">
            Manage upcoming policy renewals and review recent renewals
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={fetchData} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="bg-[#07a6ec] hover:bg-[#0696d7] flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Renewals
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Renewals</p>
                <h3 className="text-2xl font-bold">{renewalsData.stats.totalRenewals}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-[#07a6ec]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due This Month</p>
                <h3 className="text-2xl font-bold">{renewalsData.stats.dueThisMonth}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due Next Month</p>
                <h3 className="text-2xl font-bold">{renewalsData.stats.dueNextMonth}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-[#07a6ec]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Renewal Rate</p>
                <h3 className="text-2xl font-bold">{renewalsData.stats.renewalRate}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI Processed</p>
                <h3 className="text-2xl font-bold">{renewalsData.stats.aiProcessed}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming Renewals</TabsTrigger>
          <TabsTrigger value="recent">Recent Renewals</TabsTrigger>
          <TabsTrigger value="metrics">Renewal Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search renewals..." className="pl-10 w-[300px]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <select 
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="due soon">Due Soon</option>
                <option value="due next month">Due Next Month</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredRenewals.length > 0 ? (
              filteredRenewals.map((renewal) => (
                <Card key={renewal.id} className="overflow-hidden">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    onClick={() => toggleExpand(renewal.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        renewal.status === "Due Soon" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                        "bg-blue-100 dark:bg-blue-900/30"
                      }`}>
                        {renewal.status === "Due Soon" ? (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <Calendar className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">{renewal.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{renewal.id} • {renewal.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-right">Current Premium</p>
                        <p className="font-medium">{renewal.currentPremium}</p>
                      </div>
                      <div>
                        <p className="text-sm text-right">New Premium</p>
                        <p className="font-medium">{renewal.newPremium}</p>
                      </div>
                      <div>
                        <p className="text-sm text-right">Expiry Date</p>
                        <p className="font-medium">{new Date(renewal.expiryDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        {getStatusBadge(renewal.status)}
                      </div>
                      <div>
                        {expandedItem === renewal.id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {expandedItem === renewal.id && (
                    <CardContent className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Renewal Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Policy ID:</span>
                              <span>{renewal.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Customer:</span>
                              <span>{renewal.customerName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Insurance Type:</span>
                              <span>{renewal.type}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Current Premium:</span>
                              <span>{renewal.currentPremium}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">New Premium:</span>
                              <span>{renewal.newPremium}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Premium Change:</span>
                              <span className="text-red-600">{renewal.premiumChange}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Expiry Date:</span>
                              <span>{new Date(renewal.expiryDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Days Remaining:</span>
                              <span>{renewal.daysRemaining} days</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">AI Recommendation</h4>
                          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 space-y-3">
                            <div className="flex items-center gap-2">
                              <Brain className="h-5 w-5 text-[#07a6ec]" />
                              <span className="font-medium">Recommendation: {renewal.aiRecommendation.action}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">Confidence: {renewal.aiRecommendation.confidence}%</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Reason: </span>
                              <span>{renewal.aiRecommendation.reason}</span>
                            </div>
                          </div>
                          
                          <div className="mt-6 space-y-4">
                            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                              <Eye className="h-4 w-4" />
                              View Policy Details
                            </Button>
                            
                            <div className="flex gap-4">
                              <Button variant="outline" className="flex-1">
                                Modify Terms
                              </Button>
                              <Button className="flex-1 bg-[#07a6ec] hover:bg-[#0696d7]">
                                Process Renewal
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No upcoming renewals found.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <div className="space-y-4">
            {renewalsData.recentRenewals.length > 0 ? renewalsData.recentRenewals.map((renewal) => (
              <Card key={renewal.id} className="overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{renewal.customerName}</h3>
                      <p className="text-sm text-muted-foreground">{renewal.id} • {renewal.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-right">Old Premium</p>
                      <p className="font-medium">{renewal.oldPremium}</p>
                    </div>
                    <div>
                      <p className="text-sm text-right">New Premium</p>
                      <p className="font-medium">{renewal.newPremium}</p>
                    </div>
                    <div>
                      <p className="text-sm text-right">Renewal Date</p>
                      <p className="font-medium">{new Date(renewal.renewalDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      {getStatusBadge(renewal.status)}
                    </div>
                  </div>
                </div>
              </Card>
            )) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No recent renewals found.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Renewal Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-[#07a6ec]">{renewalsData.renewalMetrics.renewalRate.thisMonth}</p>
                    <p className="text-sm text-muted-foreground mt-1">This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Premium Increase</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-[#07a6ec]">{renewalsData.renewalMetrics.averagePremiumIncrease.thisMonth}</p>
                    <p className="text-sm text-muted-foreground mt-1">This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Processing Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-[#07a6ec]">{renewalsData.renewalMetrics.aiProcessingRate.thisMonth}</p>
                    <p className="text-sm text-muted-foreground mt-1">This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
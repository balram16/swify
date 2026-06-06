"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Calculator,
  Search,
  Filter,
  Brain,
  RefreshCw,
  CheckCircle,
  Clock,
  ArrowRight,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  BarChart3
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

export default function PremiumRecalculationPage() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("queue")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [premiumData, setPremiumData] = useState({
    stats: {
      totalPolicies: 0,
      recalculatedToday: 0,
      averageChange: "+0%",
      aiAccuracy: "N/A"
    },
    recalculationQueue: [] as any[],
    completedRecalculations: [] as any[],
    aiInsights: {
      premiumTrends: {
        health: "+0%",
        motor: "+0%",
        life: "+0%",
        property: "+0%"
      },
      riskFactors: [
        { name: "Age", impact: "High" },
        { name: "Medical History", impact: "High" },
        { name: "Claim History", impact: "Medium" }
      ],
      recommendations: [
        "Enable continuous AI learning on new claims",
        "Offer telematics integration for detailed risk profiling"
      ]
    }
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/policies/provider/policies')
      if (res.success && res.data) {
        const policies = res.data

        const queue: any[] = []
        let totalActive = 0

        policies.forEach((p: any) => {
          if (p.status === 'active' || p.status === 'pending') {
            totalActive++
            
            const premium = parseFloat(p.premium_amount || 0)
            
            // Generate a deterministic but variable risk profile based on DB fields
            let riskReason = "Annual Review"
            let priority = "Low"
            
            if (p.health_data) {
              priority = "High"
              riskReason = "Health profile update detected"
            } else if (p.vehicle_data) {
              priority = "Medium"
              riskReason = "Vehicle age factor"
            }

            queue.push({
              id: `RECALC-${p.policy_id}`,
              policyId: `POL-${p.policy_number || p.policy_id}`,
              customerName: p.holder_name || "Unknown",
              policyType: p.plan_name || "Insurance",
              currentPremium: `₹${premium.toLocaleString('en-IN')}`,
              status: "Queued",
              progress: 0,
              priority: priority,
              reason: riskReason
            })
          }
        })

        setPremiumData(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            totalPolicies: totalActive,
          },
          recalculationQueue: queue,
          completedRecalculations: [] // No history API yet
        }))
      }
    } catch (error) {
      console.error("Error fetching recalculation data:", error)
      toast({ title: "Error", description: "Failed to load recalculation data", variant: "destructive" })
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
  
  if (loading) {
    return (
      <div className="p-8 space-y-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading premium calculations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Premium Recalculation</h1>
          <p className="text-muted-foreground">
            Intelligent premium adjustments based on risk profiles and market trends
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" className="flex items-center gap-2" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="bg-[#07a6ec] hover:bg-[#0696d7] flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Run Batch Recalculation
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Active Policies</p>
                <h3 className="text-2xl font-bold">{premiumData.stats.totalPolicies}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileText className="h-5 w-5 text-[#07a6ec]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recalculated Today</p>
                <h3 className="text-2xl font-bold">{premiumData.stats.recalculatedToday}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Change</p>
                <h3 className="text-2xl font-bold">{premiumData.stats.averageChange}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI Accuracy</p>
                <h3 className="text-2xl font-bold">{premiumData.stats.aiAccuracy}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="queue" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-[450px]">
          <TabsTrigger value="queue">Recalculation Queue</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6">
          <div className="space-y-4">
            {premiumData.recalculationQueue.length > 0 ? premiumData.recalculationQueue.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      {item.status === "In Progress" ? (
                        <Clock className="h-5 w-5 text-[#07a6ec]" />
                      ) : (
                        <Calculator className="h-5 w-5 text-[#07a6ec]" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{item.customerName}</h3>
                      <p className="text-sm text-muted-foreground">{item.policyId} • {item.policyType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-right">Current Premium</p>
                      <p className="font-medium">{item.currentPremium}</p>
                    </div>
                    <div>
                      <Badge className={
                        item.priority === "High" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                        item.priority === "Medium" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      }>
                        {item.priority}
                      </Badge>
                    </div>
                    <div>
                      {expandedItem === item.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
                
                {expandedItem === item.id && (
                  <CardContent className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Recalculation Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className={
                              item.status === "In Progress" ? "text-blue-600" :
                              item.status === "Queued" ? "text-yellow-600" :
                              "text-green-600"
                            }>
                              {item.status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reason:</span>
                            <span>{item.reason}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Priority:</span>
                            <span>{item.priority}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Progress</h4>
                        {item.status === "In Progress" ? (
                          <div className="space-y-4">
                            <Progress value={item.progress} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Data Collection</span>
                              <span>Risk Analysis</span>
                              <span>Final Calculation</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-12">
                            <span className="text-sm text-muted-foreground">Waiting to start</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-4">
                      <Button variant="outline" className="mr-2">View Policy</Button>
                      {item.status === "Queued" && (
                        <Button className="bg-[#07a6ec] hover:bg-[#0696d7]">Start Recalculation</Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No active policies in queue.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          <div className="space-y-4">
            {premiumData.completedRecalculations.length > 0 ? premiumData.completedRecalculations.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{item.customerName}</h3>
                      <p className="text-sm text-muted-foreground">{item.policyId} • {item.policyType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm">Old Premium</p>
                      <p className="font-medium">{item.oldPremium}</p>
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="h-5 w-5 text-muted-foreground mx-2" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm">New Premium</p>
                      <p className="font-medium">{item.newPremium}</p>
                    </div>
                    <div>
                      <Badge className={
                        item.changePercentage.startsWith("+") ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      }>
                        {item.changePercentage}
                      </Badge>
                    </div>
                    <div>
                      {expandedItem === item.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No completed recalculations found.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Premium Trends by Insurance Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 pt-4">
                  {Object.entries(premiumData.aiInsights.premiumTrends).map(([type, trend]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type} Insurance</span>
                      <Badge className={
                        trend.startsWith("+") ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      }>
                        {trend}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Factor Impact Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 pt-4">
                  {premiumData.aiInsights.riskFactors.map((factor, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        factor.impact === "High" ? "bg-red-100 dark:bg-red-900/30" :
                        factor.impact === "Medium" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                        "bg-green-100 dark:bg-green-900/30"
                      }`}>
                        <AlertTriangle className={`h-5 w-5 ${
                          factor.impact === "High" ? "text-red-600" :
                          factor.impact === "Medium" ? "text-yellow-600" :
                          "text-green-600"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{factor.name}</h4>
                        <p className="text-sm text-muted-foreground">Impact: {factor.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {premiumData.aiInsights.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Brain className="h-5 w-5 text-[#07a6ec]" />
                    </div>
                    <div>
                      <p>{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
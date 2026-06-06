"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Search,
  Filter,
  Download,
  FileText,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle,
  CreditCard,
  Wallet,
  Landmark,
  ArrowUpRight,
  RefreshCw
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

export default function PaymentsPage() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("recent")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [paymentsData, setPaymentsData] = useState({
    stats: {
      totalCollected: "₹0",
      pendingPaymentsAmount: "₹0",
      overduePaymentsAmount: "₹0",
      collectionRate: "0%",
      monthlyGrowth: "0%"
    },
    recentPayments: [] as any[],
    pendingPayments: [] as any[],
    paymentMethods: {
      creditCard: 0,
      netBanking: 0,
      upi: 0,
      others: 0
    }
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/policies/provider/policies')
      if (res.success && res.data) {
        const policies = res.data

        let totalCollected = 0
        let pendingAmount = 0
        let overdueAmount = 0
        let totalPoliciesWithPremium = 0

        const recent: any[] = []
        const pending: any[] = []

        policies.forEach((p: any) => {
          const premium = parseFloat(p.premium_amount || 0)
          if (premium > 0) {
            totalPoliciesWithPremium++
          }

          const status = p.payment_status || 'pending'
          const date = p.created_at || new Date().toISOString()
          const pMethod = "Credit Card" // Default mapped for now as DB might not store it here

          const basePayment = {
            id: `PAY-${p.policy_id}-${Date.now().toString().slice(-4)}`,
            policyId: `POL-${p.policy_number || p.policy_id}`,
            customerName: p.holder_name || "Unknown",
            policyType: p.plan_name || "Insurance",
            amount: `₹${premium.toLocaleString('en-IN')}`,
            rawAmount: premium,
            date: date,
            method: pMethod
          }

          if (status === 'completed') {
            totalCollected += premium
            recent.push({
              ...basePayment,
              status: "Successful",
              cardDetails: "**** **** **** 1234",
              transactionId: `TXN${p.policy_id}${Date.now().toString().slice(-6)}`,
              receiptGenerated: true
            })
          } else {
            pendingAmount += premium
            const dueDateStr = p.end_date || new Date(Date.now() + 86400000 * 30).toISOString()
            const dueDate = new Date(dueDateStr)
            const now = new Date()
            
            let pStatus = "Due"
            let daysOverdue = 0

            if (now > dueDate) {
              pStatus = "Overdue"
              overdueAmount += premium
              daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24))
            } else if ((dueDate.getTime() - now.getTime()) < 86400000 * 7) {
              pStatus = "Due Soon"
            }

            pending.push({
              ...basePayment,
              dueDate: dueDateStr,
              status: pStatus,
              reminderSent: false,
              daysOverdue
            })
          }
        })

        const collectionRate = totalPoliciesWithPremium > 0 
          ? Math.round((recent.length / totalPoliciesWithPremium) * 100) 
          : 0

        setPaymentsData({
          stats: {
            totalCollected: `₹${totalCollected.toLocaleString('en-IN')}`,
            pendingPaymentsAmount: `₹${pendingAmount.toLocaleString('en-IN')}`,
            overduePaymentsAmount: `₹${overdueAmount.toLocaleString('en-IN')}`,
            collectionRate: `${collectionRate}%`,
            monthlyGrowth: "+0%" // Static for now until historical data is tracked
          },
          recentPayments: recent,
          pendingPayments: pending,
          paymentMethods: {
            creditCard: recent.length > 0 ? 100 : 0, // Mocked distribution
            netBanking: 0,
            upi: 0,
            others: 0
          }
        })
      }
    } catch (error) {
      console.error("Error fetching payments data:", error)
      toast({ title: "Error", description: "Failed to load payments data", variant: "destructive" })
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
  
  const filteredPayments = paymentsData.recentPayments.filter(payment => {
    if (statusFilter !== "all" && payment.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        payment.id.toLowerCase().includes(query) ||
        payment.customerName.toLowerCase().includes(query) ||
        payment.policyId.toLowerCase().includes(query)
      )
    }
    return true
  })
  
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "successful":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{status}</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{status}</Badge>
      case "processing":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{status}</Badge>
      case "due":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{status}</Badge>
      case "due soon":
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">{status}</Badge>
      case "overdue":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{status}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }
  
  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case "credit card":
        return <CreditCard className="h-5 w-5 text-blue-600" />
      case "net banking":
        return <Landmark className="h-5 w-5 text-green-600" />
      case "upi":
        return <Wallet className="h-5 w-5 text-purple-600" />
      case "cheque":
        return <FileText className="h-5 w-5 text-yellow-600" />
      default:
        return <DollarSign className="h-5 w-5 text-[#07a6ec]" />
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading premium payments...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Premium Payments</h1>
          <p className="text-muted-foreground">
            Track and manage all policy premium payments
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={fetchData} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="bg-[#07a6ec] hover:bg-[#0696d7] flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Collected</p>
                <h3 className="text-2xl font-bold">{paymentsData.stats.totalCollected}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Payments</p>
                <h3 className="text-2xl font-bold">{paymentsData.stats.pendingPaymentsAmount}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue Payments</p>
                <h3 className="text-2xl font-bold">{paymentsData.stats.overduePaymentsAmount}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Collection Rate</p>
                <h3 className="text-2xl font-bold">{paymentsData.stats.collectionRate}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Growth</p>
                <h3 className="text-2xl font-bold">{paymentsData.stats.monthlyGrowth}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recent" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="recent">Recent Payments</TabsTrigger>
          <TabsTrigger value="pending">Pending Payments</TabsTrigger>
          <TabsTrigger value="analytics">Payment Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search payments..."
                className="pl-8 w-full sm:w-[300px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <select
                className="border rounded-md px-3 py-2 bg-background"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="successful">Successful</option>
                <option value="failed">Failed</option>
                <option value="processing">Processing</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredPayments.length > 0 ? (
              filteredPayments.map((payment) => (
                <Card key={payment.id} className="overflow-hidden">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    onClick={() => toggleExpand(payment.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        payment.method === "Credit Card" ? "bg-blue-100 dark:bg-blue-900/30" :
                        payment.method === "Net Banking" ? "bg-green-100 dark:bg-green-900/30" :
                        payment.method === "UPI" ? "bg-purple-100 dark:bg-purple-900/30" :
                        "bg-yellow-100 dark:bg-yellow-900/30"
                      }`}>
                        {getMethodIcon(payment.method)}
                      </div>
                      <div>
                        <h3 className="font-medium">{payment.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{payment.id} • {payment.policyId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-right">Amount</p>
                        <p className="font-medium">{payment.amount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-right">Method</p>
                        <p className="font-medium">{payment.method}</p>
                      </div>
                      <div>
                        <p className="text-sm text-right">Date</p>
                        <p className="font-medium">{new Date(payment.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        {getStatusBadge(payment.status)}
                      </div>
                      <div>
                        {expandedItem === payment.id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {expandedItem === payment.id && (
                    <CardContent className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Payment Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Payment ID:</span>
                              <span>{payment.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Policy ID:</span>
                              <span>{payment.policyId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Customer:</span>
                              <span>{payment.customerName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Policy Type:</span>
                              <span>{payment.policyType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amount:</span>
                              <span>{payment.amount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Date:</span>
                              <span>{new Date(payment.date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Method:</span>
                              <span>{payment.method}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              <span>{payment.status}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Transaction ID:</span>
                              <span>{payment.transactionId}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">Actions</h4>
                          <div className="space-y-4">
                            {payment.status === "Successful" && (
                              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                  <span>Payment successful</span>
                                </div>
                                <Button variant="outline" size="sm" className="flex items-center gap-2">
                                  <Download className="h-4 w-4" />
                                  Download Receipt
                                </Button>
                              </div>
                            )}
                            <div className="flex justify-end mt-4">
                              <Button variant="outline" className="mr-2">View Policy</Button>
                              <Button className="bg-[#07a6ec] hover:bg-[#0696d7]">Contact Customer</Button>
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
                <p className="text-muted-foreground">No recent payments found.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-6">
          <div className="space-y-4">
            {paymentsData.pendingPayments.length > 0 ? paymentsData.pendingPayments.map((payment) => (
              <Card key={payment.id} className="overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      payment.status === "Overdue" ? "bg-red-100 dark:bg-red-900/30" :
                      payment.status === "Due Soon" ? "bg-purple-100 dark:bg-purple-900/30" :
                      "bg-blue-100 dark:bg-blue-900/30"
                    }`}>
                      {payment.status === "Overdue" ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : payment.status === "Due Soon" ? (
                        <Clock className="h-5 w-5 text-purple-600" />
                      ) : (
                        <Calendar className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{payment.customerName}</h3>
                      <p className="text-sm text-muted-foreground">{payment.id} • {payment.policyType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-right">Amount</p>
                      <p className="font-medium">{payment.amount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-right">Due Date</p>
                      <p className="font-medium">{new Date(payment.dueDate).toLocaleDateString()}</p>
                    </div>
                    {payment.status === "Overdue" && (
                      <div>
                        <p className="text-sm text-right">Days Overdue</p>
                        <p className="font-medium text-red-600">{payment.daysOverdue}</p>
                      </div>
                    )}
                    <div>
                      {getStatusBadge(payment.status)}
                    </div>
                    <div className="flex gap-2">
                      <Button className="bg-[#07a6ec] hover:bg-[#0696d7] h-8">
                        Send Reminder
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No pending payments found.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 pt-4">
                  {Object.entries(paymentsData.paymentMethods).map(([method, percentage]) => (
                    <div key={method} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="capitalize">{method === "upi" ? "UPI" : method.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span>{percentage}%</span>
                      </div>
                      <Progress value={percentage as number} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collection Efficiency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-[#07a6ec]">{paymentsData.stats.collectionRate}</p>
                    <p className="text-sm text-muted-foreground mt-1">Overall Collection Rate</p>
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
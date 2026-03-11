"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Filter,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Calendar,
  Brain
} from "lucide-react"

import apiClient from "@/lib/api-client"

export default function AllClaimsPage() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)

  const fetchPending = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<any>("/claims/pending-claims")
      setClaims(res?.claims || [])
    } catch (e: any) {
      setError(e?.message || "Failed to fetch claims")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPending()
  }, [])
  
  const toggleExpand = (id: string) => {
    if (expandedItem === id) {
      setExpandedItem(null)
    } else {
      setExpandedItem(id)
    }
  }
  
  const filteredClaims = claims.filter((claim: any) => {
    // Apply status filter
    if (statusFilter !== "all" && (claim.claim_status || '').toLowerCase() !== statusFilter.toLowerCase()) {
      return false
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        String(claim.claim_id).toLowerCase().includes(query) ||
        String(claim.policyholder_name || '').toLowerCase().includes(query) ||
        String(claim.policy_number || '').toLowerCase().includes(query)
      )
    }
    
    return true
  })
  
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{status}</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{status}</Badge>
      case "under review":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{status}</Badge>
      case "pending documentation":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{status}</Badge>
      case "fraud investigation":
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">{status}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }
  
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Claims</h1>
          <p className="text-muted-foreground">
            Comprehensive view of all insurance claims
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" className="flex items-center gap-2" onClick={fetchPending} disabled={loading}>
            <Calendar className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="bg-[#07a6ec] hover:bg-[#0696d7] flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Claims
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Claims</p>
                <h3 className="text-2xl font-bold">{claims.length}</h3>
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
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <h3 className="text-2xl font-bold">{claims.filter((c:any)=>c.claim_status==='pending').length}</h3>
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
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <h3 className="text-2xl font-bold">{claims.filter((c:any)=>c.claim_status==='approved').length}</h3>
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
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <h3 className="text-2xl font-bold">{claims.filter((c:any)=>c.claim_status==='rejected').length}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <h3 className="text-2xl font-bold">{claims.filter((c:any)=>c.claim_status==='processing').length}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search claims..." 
              className="pl-10 w-[300px]" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="under review">Under Review</option>
            <option value="pending documentation">Pending Documentation</option>
            <option value="fraud investigation">Fraud Investigation</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            More Filters
          </Button>
        </div>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        {loading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {!loading && filteredClaims.length > 0 ? (
          filteredClaims.map((claim: any) => (
            <Card key={claim.claim_id} className="overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                onClick={() => toggleExpand(String(claim.claim_id))}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    claim.status === "Approved" ? "bg-green-100 dark:bg-green-900/30" :
                    claim.status === "Rejected" ? "bg-red-100 dark:bg-red-900/30" :
                    claim.status === "Under Review" ? "bg-blue-100 dark:bg-blue-900/30" :
                    claim.status === "Pending Documentation" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                    "bg-purple-100 dark:bg-purple-900/30"
                  }`}>
                    {claim.status === "Approved" ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : claim.status === "Rejected" ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : claim.status === "Under Review" ? (
                      <Clock className="h-5 w-5 text-blue-600" />
                    ) : claim.status === "Pending Documentation" ? (
                      <FileText className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">{claim.customerName}</h3>
                    <p className="text-sm text-muted-foreground">{claim.id} • {claim.policyNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-right">Type</p>
                    <p className="font-medium">{claim.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-right">Amount</p>
                    <p className="font-medium">{claim.amount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-right">Date</p>
                    <p className="font-medium">{new Date(claim.submittedDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    {getStatusBadge(claim.claim_status || '')}
                  </div>
                  <div>
                    {expandedItem === String(claim.claim_id) ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
              
              {expandedItem === String(claim.claim_id) && (
                <CardContent className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Claim Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Claim ID:</span>
                          <span>{claim.claim_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Policy Number:</span>
                          <span>{claim.policy_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Customer:</span>
                          <span>{claim.policyholder_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span>{claim.claim_type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span>{claim.claim_amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Submitted:</span>
                          <span>{claim.filing_date ? new Date(claim.filing_date).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <span>{claim.claim_status}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-2">Actions</h4>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50"
                          disabled={verifyLoading}
                          onClick={async (e) => {
                            e.stopPropagation()
                            setVerifyLoading(true)
                            try {
                              const res = await apiClient.post(`/claims/claim/${claim.claim_id}/verify`) as any
                              console.log('AI Verify response:', res)
                              const analysis = res?.analysis || res?.data?.analysis || res
                              if (analysis && analysis.riskScore !== undefined) {
                                setAiResult(analysis)
                                setAiDialogOpen(true)
                              } else {
                                alert('AI Analysis completed but no score returned. Check console.')
                              }
                              fetchPending()
                            } catch(e: any) { alert(e.message || 'Verify failed') }
                            finally { setVerifyLoading(false) }
                          }}
                        >
                          <Brain className="h-4 w-4 mr-1" /> {verifyLoading ? 'Analyzing...' : 'AI Verify'}
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={claim.claim_status === 'approved'}
                          onClick={async () => {
                            try {
                              await apiClient.post(`/claims/claim/${claim.claim_id}/approve`, { approvedAmount: claim.claim_amount })
                              alert('Claim approved!')
                              fetchPending()
                            } catch(e: any) { alert(e.message || 'Failed') }
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={claim.claim_status === 'rejected'}
                          onClick={async () => {
                            try {
                              await apiClient.post(`/claims/claim/${claim.claim_id}/reject`, { reason: 'Rejected by provider' })
                              alert('Claim rejected')
                              fetchPending()
                            } catch(e: any) { alert(e.message || 'Failed') }
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" className="mr-2">View Details</Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No claims match your search criteria</p>
          </div>
        )}
      </div>

      {/* AI Analysis Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              AI Claim Analysis
            </DialogTitle>
          </DialogHeader>
          {aiResult && (
            <div className="space-y-5">
              {/* Score Display */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${
                    aiResult.riskScore <= 25 ? 'text-green-600' :
                    aiResult.riskScore <= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {aiResult.riskScore}
                  </div>
                  <div className="text-xs text-muted-foreground">Risk Score</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">{aiResult.confidenceScore}%</div>
                  <div className="text-xs text-muted-foreground">Confidence</div>
                </div>
                <div className="text-center">
                  <Badge className={`text-sm px-3 py-1 ${
                    aiResult.recommendation === 'approve' ? 'bg-green-100 text-green-800' :
                    aiResult.recommendation === 'review' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {aiResult.recommendation === 'approve' ? '✅ Approve' :
                     aiResult.recommendation === 'review' ? '⚠️ Review' : '❌ Reject'}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">Recommendation</div>
                </div>
              </div>

              {/* Summary */}
              <p className="text-sm font-medium">{aiResult.summary}</p>

              {/* Risk Factors */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Analysis Factors</h4>
                <div className="space-y-2">
                  {aiResult.factors?.map((f: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm border rounded p-2">
                      <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                        f.impact === 'high' ? 'bg-red-500' :
                        f.impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      <div>
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground"> — {f.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={() => setAiDialogOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 
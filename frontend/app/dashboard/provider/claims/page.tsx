"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileText,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Clock,
  AlertCircle,
  IndianRupee,
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

interface Claim {
  claim_id: number
  claim_amount: number
  approved_amount?: number
  claim_status: string
  claim_type: string
  filing_date: string
  incident_description: string
  policy_id: number
  policyholder_name: string
  policyholder_email: string
  policy_number: string
  policy_type: string
  coverage_amount: number
  processing_notes?: string
}

export default function ProviderClaimsPage() {
  const { toast } = useToast()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | null>(null)
  const [actionNotes, setActionNotes] = useState("")
  const [approvedAmount, setApprovedAmount] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const fetchClaims = async () => {
    try {
      setLoading(true)
      const res = await apiClient.get("/claims/pending-claims")
      if (res.success) {
        setClaims(res.claims)
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to fetch claims", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClaims()
  }, [])

  const handleApprove = async () => {
    if (!selectedClaim) return
    setActionLoading(true)
    try {
      await apiClient.post(`/claims/claim/${selectedClaim.claim_id}/approve`, {
        approvedAmount: approvedAmount ? parseFloat(approvedAmount) : selectedClaim.claim_amount,
        notes: actionNotes || "Claim approved",
      })
      toast({ title: "✅ Claim Approved", description: `Claim #${selectedClaim.claim_id} approved successfully` })
      setActionDialog(null)
      setSelectedClaim(null)
      setActionNotes("")
      setApprovedAmount("")
      fetchClaims()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve claim", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedClaim) return
    setActionLoading(true)
    try {
      await apiClient.post(`/claims/claim/${selectedClaim.claim_id}/reject`, {
        reason: actionNotes || "Claim rejected by provider",
      })
      toast({ title: "Claim Rejected", description: `Claim #${selectedClaim.claim_id} has been rejected` })
      setActionDialog(null)
      setSelectedClaim(null)
      setActionNotes("")
      fetchClaims()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject claim", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    paid: "bg-blue-100 text-blue-800",
  }

  const filtered = claims.filter((c) => {
    const matchSearch =
      c.policyholder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.policy_type?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === "all" || c.claim_status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total: claims.length,
    pending: claims.filter((c) => c.claim_status === "pending").length,
    approved: claims.filter((c) => c.claim_status === "approved").length,
    rejected: claims.filter((c) => c.claim_status === "rejected").length,
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claims Management</h1>
          <p className="text-muted-foreground">Review and process insurance claims from your policyholders</p>
        </div>
        <Button variant="outline" onClick={fetchClaims} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Claims", value: stats.total, icon: FileText, color: "blue" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "yellow" },
          { label: "Approved", value: stats.approved, icon: CheckCircle, color: "green" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, color: "red" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-${stat.color}-100 rounded-full`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}-600`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, policy..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected"].map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(s)}
              className={filterStatus === s ? "bg-[#07a6ec] hover:bg-[#0696d7]" : ""}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Claims List */}
      <Card>
        <CardHeader>
          <CardTitle>Claims ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium text-lg">No claims found</h3>
              <p className="text-muted-foreground text-sm">
                {searchTerm || filterStatus !== "all"
                  ? "No claims match your filter"
                  : "No claims have been filed yet on your policies"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((claim) => (
                <div key={claim.claim_id} className="border rounded-lg p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{claim.policyholder_name}</h4>
                        <Badge className={statusColors[claim.claim_status] || "bg-gray-100 text-gray-800"}>
                          {claim.claim_status}
                        </Badge>
                        <Badge variant="outline">Claim #{claim.claim_id}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
                        <span>📋 {claim.policy_number || `Policy #${claim.policy_id}`}</span>
                        <span>🏷️ {claim.policy_type} Insurance</span>
                        <span>📅 {new Date(claim.filing_date).toLocaleDateString("en-IN")}</span>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-green-700">
                        <IndianRupee className="h-4 w-4" />
                        {parseFloat(claim.claim_amount as any).toLocaleString("en-IN")}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          (Coverage: ₹{parseFloat(claim.coverage_amount as any).toLocaleString("en-IN")})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground italic">
                        "{claim.incident_description}"
                      </p>
                      {claim.processing_notes && (
                        <p className="text-xs text-muted-foreground">Note: {claim.processing_notes}</p>
                      )}
                    </div>
                    {claim.claim_status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            setSelectedClaim(claim)
                            setApprovedAmount(String(claim.claim_amount))
                            setActionDialog("approve")
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedClaim(claim)
                            setActionDialog("reject")
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                    {claim.claim_status !== "pending" && (
                      <Badge className={statusColors[claim.claim_status]}>
                        {claim.claim_status === "approved" ? `✅ ₹${claim.approved_amount?.toLocaleString("en-IN")} Approved` : "❌ Rejected"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={actionDialog === "approve"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Claim #{selectedClaim?.claim_id}</DialogTitle>
            <DialogDescription>
              From: <strong>{selectedClaim?.policyholder_name}</strong> — {selectedClaim?.policy_type} Insurance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Approved Amount (₹)</label>
              <Input
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                placeholder={String(selectedClaim?.claim_amount)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Claimed: ₹{selectedClaim?.claim_amount?.toLocaleString("en-IN")} | Coverage: ₹{selectedClaim?.coverage_amount?.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add any approval notes..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === "reject"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Claim #{selectedClaim?.claim_id}</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium">Rejection Reason</label>
            <Textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="e.g. Insufficient documentation, claim amount exceeds limit..."
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
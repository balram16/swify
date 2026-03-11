"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import {
  Shield,
  Search,
  RefreshCw,
  ShoppingCart,
  Eye,
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  IndianRupee,
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

interface PolicyTemplate {
  template_id: number
  policy_type: string
  coverage_amount: number
  premium: number
  insurance_exp_date: string
  max_claims_per_year: number
  description: string
  terms_and_conditions: string
  is_active: boolean
  created_at: string
  provider_name: string
  provider_email: string
  blockchain_template_id: number
}

interface Policy {
  policy_id: number
  policy_number: string
  policy_type: string
  coverage_amount: number
  premium: number
  start_date: string
  end_date: string
  status: string
  provider_name: string
  provider_email: string
  created_at: string
  blockchain_policy_id: number
}

interface Claim {
  claim_id: number
  claim_amount: number
  claim_status: string
  claim_type: string
  filing_date: string
  incident_description: string
  policy_number: string
  policy_type: string
}

export default function HolderPoliciesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("purchase")
  const [templates, setTemplates] = useState<PolicyTemplate[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [myClaims, setMyClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Claim dialog
  const [claimDialog, setClaimDialog] = useState(false)
  const [claimPolicy, setClaimPolicy] = useState<Policy | null>(null)
  const [claimAmount, setClaimAmount] = useState("")
  const [claimDesc, setClaimDesc] = useState("")
  const [claimLoading, setClaimLoading] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [templatesRes, policiesRes, claimsRes] = await Promise.all([
        apiClient.get('/policies/templates'),
        apiClient.get('/policies/user/policies'),
        apiClient.get('/claims/me'),
      ])
      if (templatesRes.success) setTemplates(templatesRes.data)
      if (policiesRes.success) setPolicies(policiesRes.data)
      if (claimsRes.success) setMyClaims(claimsRes.claims)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({ title: "Error", description: "Failed to fetch policy data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openClaimDialog = (policy: Policy) => {
    setClaimPolicy(policy)
    setClaimAmount("")
    setClaimDesc("")
    setClaimDialog(true)
  }

  const handleFileClaim = async () => {
    if (!claimPolicy || !claimAmount || !claimDesc) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" })
      return
    }
    setClaimLoading(true)
    try {
      await apiClient.post('/claims/claim', {
        policyId: claimPolicy.policy_id,
        claimAmount: parseFloat(claimAmount),
        incidentDescription: claimDesc,
        claimType: claimPolicy.policy_type,
      })
      toast({ title: "✅ Claim Filed!", description: "Your claim has been submitted. The provider will review it shortly." })
      setClaimDialog(false)
      fetchData()
      setActiveTab("my-claims")
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to file claim", variant: "destructive" })
    } finally {
      setClaimLoading(false)
    }
  }


  const copyPolicyNumber = (policyNumber: string) => {
    navigator.clipboard.writeText(policyNumber)
    toast({
      title: "Copied",
      description: "Policy number copied to clipboard",
    })
  }

  const filteredTemplates = templates.filter(template =>
    template.policy_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.provider_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPolicies = policies.filter(policy =>
    policy.policy_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    policy.policy_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    policy.provider_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading policy data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Insurance Policies</h1>
          <p className="text-muted-foreground">
            Purchase new policies and manage your existing ones
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">My Policies</p>
                <h3 className="text-2xl font-bold">{policies.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Policies</p>
                <h3 className="text-2xl font-bold">
                  {policies.filter(p => p.status === 'active').length}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <ShoppingCart className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Policies</p>
                <h3 className="text-2xl font-bold">{templates.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="purchase">Purchase Policy</TabsTrigger>
            <TabsTrigger value="my-policies">My Policies</TabsTrigger>
            <TabsTrigger value="my-claims">My Claims ({myClaims.length})</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search policies..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <TabsContent value="purchase">
          <div className="space-y-4">
            {filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Policies Available</h3>
                  <p className="text-muted-foreground">
                    No insurance policies are currently available for purchase.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredTemplates.map((template) => (
                <Card key={template.template_id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{template.policy_type} Insurance</h3>
                          <Badge variant="outline">Template #{template.template_id}</Badge>
                          <Badge className={template.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {template.is_active ? "Available" : "Unavailable"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>Coverage: ₹{template.coverage_amount.toLocaleString()}</span>
                          <span>Premium: ₹{template.premium.toLocaleString()}</span>
                          <span>Max Claims: {template.max_claims_per_year}/year</span>
                          <span>Expires: {new Date(template.insurance_exp_date).toLocaleDateString()}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Provider: {template.provider_name} ({template.provider_email})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // Show terms and conditions in a modal or new tab
                            window.open(`/policies/template/${template.template_id}/terms`, '_blank')
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Terms
                        </Button>
                        <Link href={`/dashboard/holder/policies/purchase?templateId=${template.template_id}`}>
                          <Button 
                            size="sm"
                            className="bg-[#07a6ec] hover:bg-[#0696d7]"
                            disabled={!template.is_active}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Purchase Policy
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="my-policies">
          <div className="space-y-4">
            {filteredPolicies.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Policies Purchased</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't purchased any insurance policies yet.
                  </p>
                  <Button 
                    onClick={() => setActiveTab("purchase")}
                    className="bg-[#07a6ec] hover:bg-[#0696d7]"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Browse Policies
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredPolicies.map((policy) => (
                <Card key={policy.policy_id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{policy.policy_type} Insurance</h3>
                          <Badge variant="outline">{policy.policy_number}</Badge>
                          <Badge className={
                            policy.status === 'active' 
                              ? "bg-green-100 text-green-800" 
                              : policy.status === 'expired'
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }>
                            {policy.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {policy.status === 'expired' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {policy.status === 'cancelled' && <Clock className="h-3 w-3 mr-1" />}
                            {policy.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          Provider: {policy.provider_name} ({policy.provider_email})
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>Coverage: ₹{policy.coverage_amount.toLocaleString()}</span>
                          <span>Premium: ₹{policy.premium.toLocaleString()}</span>
                          <span>Start: {new Date(policy.start_date).toLocaleDateString()}</span>
                          <span>End: {new Date(policy.end_date).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Purchased: {new Date(policy.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyPolicyNumber(policy.policy_number)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy #
                        </Button>
                        <Link href={`/dashboard/holder/policies/${policy.policy_id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </Link>
                        {policy.status === 'active' && (
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={() => openClaimDialog(policy)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            File a Claim
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* My Claims Tab */}
        <TabsContent value="my-claims">
          <div className="space-y-4">
            {myClaims.length === 0 ? (
              <Card><CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Claims Filed</h3>
                <p className="text-muted-foreground">Go to "My Policies" and click "File a Claim" on any active policy.</p>
              </CardContent></Card>
            ) : (
              myClaims.map((claim) => (
                <Card key={claim.claim_id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">Claim #{claim.claim_id}</h4>
                          <Badge className={
                            claim.claim_status === 'approved' ? 'bg-green-100 text-green-800' :
                            claim.claim_status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>{claim.claim_status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{claim.policy_type} — {claim.policy_number}</p>
                        <p className="text-sm italic text-muted-foreground">"{claim.incident_description}"</p>
                        <p className="text-xs text-muted-foreground">Filed: {new Date(claim.filing_date).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="flex items-center gap-1 text-green-700 font-semibold">
                        <IndianRupee className="h-4 w-4" />
                        {parseFloat(claim.claim_amount as any).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* File a Claim Dialog */}
      <Dialog open={claimDialog} onOpenChange={setClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File a Claim</DialogTitle>
            <DialogDescription>
              {claimPolicy?.policy_type} Insurance — Policy {claimPolicy?.policy_number}<br />
              Coverage: ₹{claimPolicy?.coverage_amount?.toLocaleString('en-IN')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Claim Amount (₹)</Label>
              <Input
                type="number"
                className="mt-1"
                placeholder="Enter amount"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                max={claimPolicy?.coverage_amount}
                min={1}
              />
            </div>
            <div>
              <Label>Incident Description</Label>
              <Textarea
                className="mt-1"
                placeholder="Describe what happened and why you're filing this claim..."
                value={claimDesc}
                onChange={(e) => setClaimDesc(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialog(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleFileClaim}
              disabled={claimLoading}
            >
              {claimLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Submit Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

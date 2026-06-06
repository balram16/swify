"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Upload, FileText, User, Shield, CreditCard, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  provider_name: string
  provider_email: string
}

interface Beneficiary {
  name: string
  relationship: string
  age: number
  gender: string
  aadhar_number: string
  date_of_birth: string
  is_primary: boolean
}

interface Document {
  type: string
  file: File
  preview: string
}

export default function PurchasePolicyPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [templateId, setTemplateId] = useState<string>("")
  const [template, setTemplate] = useState<PolicyTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  // Customer Details
  const [customerDetails, setCustomerDetails] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    aadharNumber: "",
    panNumber: "",
    dateOfBirth: "",
    gender: "",
    occupation: "",
    annualIncome: ""
  })

  // Policy Details
  const [policyDetails, setPolicyDetails] = useState({
    planName: "",
    membersCount: 1,
    startDate: "",
    nomineeName: "",
    nomineeRelationship: "",
    nomineePhone: ""
  })

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    {
      name: "",
      relationship: "Self",
      age: 0,
      gender: "",
      aadhar_number: "",
      date_of_birth: "",
      is_primary: true
    }
  ])

  // Documents
  const [documents, setDocuments] = useState<Document[]>([])

  // Payment Details
  const [paymentDetails, setPaymentDetails] = useState({
    paymentMethod: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    upiId: "",
    bankAccount: ""
  })

  const documentTypes = [
    "Identity Proof (Aadhar/PAN)",
    "Address Proof"
  ]

  const relationships = [
    "Self", "Spouse", "Son", "Daughter", "Father", "Mother", 
    "Brother", "Sister", "Other"
  ]

  const genders = ["Male", "Female", "Other"]

  const paymentMethods = ["Credit Card", "Debit Card", "Net Banking", "UPI", "Bank Transfer"]

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const id = urlParams.get('templateId')
    if (id) {
      setTemplateId(id)
      fetchTemplate(id)
    }
  }, [])

  const fetchTemplate = async (id: string) => {
    try {
      const response = await apiClient.get(`/policies/templates`)
      if (response.success) {
        const template = response.data.find((t: PolicyTemplate) => t.template_id === parseInt(id))
        if (template) {
          setTemplate(template)
        } else {
          toast({
            title: "Error",
            description: "Policy template not found",
            variant: "destructive"
          })
          router.back()
        }
      }
    } catch (error) {
      console.error('Error fetching template:', error)
      toast({
        title: "Error",
        description: "Failed to fetch policy template",
        variant: "destructive"
      })
    }
  }

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, {
      name: "",
      relationship: "Other",
      age: 0,
      gender: "",
      aadhar_number: "",
      date_of_birth: "",
      is_primary: false
    }])
  }

  const removeBeneficiary = (index: number) => {
    if (beneficiaries.length > 1) {
      setBeneficiaries(beneficiaries.filter((_, i) => i !== index))
    }
  }

  const updateBeneficiary = (index: number, field: keyof Beneficiary, value: any) => {
    const updated = [...beneficiaries]
    updated[index] = { ...updated[index], [field]: value }
    setBeneficiaries(updated)
  }

  const handleDocumentUpload = (type: string, file: File) => {
    const preview = URL.createObjectURL(file)
    setDocuments([...documents, { type, file, preview }])
  }

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  const getTabCompletionStatus = (tab: string) => {
    switch (tab) {
      case 'details':
        const detailsFields = [
          customerDetails.fullName, customerDetails.email, customerDetails.phone,
          customerDetails.aadharNumber, customerDetails.panNumber, customerDetails.dateOfBirth,
          customerDetails.gender, customerDetails.occupation, customerDetails.annualIncome,
          customerDetails.address
        ]
        const completedDetails = detailsFields.filter(field => field && field.trim() !== '').length
        return { completed: completedDetails, total: detailsFields.length }
      
      case 'policy':
        const policyFields = [
          policyDetails.planName, policyDetails.startDate, policyDetails.nomineeName,
          policyDetails.nomineeRelationship, policyDetails.nomineePhone
        ]
        const completedPolicy = policyFields.filter(field => field && field.trim() !== '').length
        return { completed: completedPolicy, total: policyFields.length }
      
      case 'beneficiaries':
        const allBeneficiariesComplete = beneficiaries.every(beneficiary => 
          beneficiary.name && beneficiary.relationship && beneficiary.age > 0 &&
          beneficiary.gender && beneficiary.aadhar_number && beneficiary.date_of_birth
        )
        return { completed: allBeneficiariesComplete ? beneficiaries.length : 0, total: beneficiaries.length }
      
      case 'documents':
        const requiredDocumentTypes = [
          "Identity Proof (Aadhar/PAN)", "Address Proof"
        ]
        const uploadedTypes = documents.map(doc => doc.type)
        const completedDocs = requiredDocumentTypes.filter(type => uploadedTypes.includes(type)).length
        return { completed: completedDocs, total: requiredDocumentTypes.length }
      
      case 'payment':
        let paymentFields = [paymentDetails.paymentMethod]
        if (paymentDetails.paymentMethod === "Credit Card" || paymentDetails.paymentMethod === "Debit Card") {
          paymentFields.push(paymentDetails.cardNumber, paymentDetails.expiryDate, paymentDetails.cvv)
        } else if (paymentDetails.paymentMethod === "UPI") {
          paymentFields.push(paymentDetails.upiId)
        } else if (paymentDetails.paymentMethod === "Bank Transfer") {
          paymentFields.push(paymentDetails.bankAccount)
        }
        const completedPayment = paymentFields.filter(field => field && field.trim() !== '').length
        return { completed: completedPayment, total: paymentFields.length }
      
      default:
        return { completed: 0, total: 0 }
    }
  }

  const validateForm = () => {
    // Validate customer details
    if (!customerDetails.fullName || !customerDetails.email || !customerDetails.phone || 
        !customerDetails.aadharNumber || !customerDetails.panNumber || !customerDetails.dateOfBirth ||
        !customerDetails.gender || !customerDetails.occupation || !customerDetails.annualIncome ||
        !customerDetails.address) {
      toast({
        title: "Validation Error",
        description: "Please fill in all customer details",
        variant: "destructive"
      })
      return false
    }

    // Validate policy details
    if (!policyDetails.planName || !policyDetails.startDate || !policyDetails.nomineeName ||
        !policyDetails.nomineeRelationship || !policyDetails.nomineePhone) {
      toast({
        title: "Validation Error", 
        description: "Please fill in all policy details",
        variant: "destructive"
      })
      return false
    }

    // Validate beneficiaries
    for (const beneficiary of beneficiaries) {
      if (!beneficiary.name || !beneficiary.relationship || beneficiary.age <= 0 ||
          !beneficiary.gender || !beneficiary.aadhar_number || !beneficiary.date_of_birth) {
        toast({
          title: "Validation Error",
          description: "Please fill in all beneficiary details",
          variant: "destructive"
        })
        return false
      }
    }

    // Validate payment details
    if (!paymentDetails.paymentMethod) {
      toast({
        title: "Validation Error",
        description: "Please select a payment method",
        variant: "destructive"
      })
      return false
    }

    // Validate payment method specific fields
    if (paymentDetails.paymentMethod === "Credit Card" || paymentDetails.paymentMethod === "Debit Card") {
      if (!paymentDetails.cardNumber || !paymentDetails.expiryDate || !paymentDetails.cvv) {
        toast({
          title: "Validation Error",
          description: "Please fill in all card details",
          variant: "destructive"
        })
        return false
      }
    } else if (paymentDetails.paymentMethod === "UPI") {
      if (!paymentDetails.upiId) {
        toast({
          title: "Validation Error",
          description: "Please enter your UPI ID",
          variant: "destructive"
        })
        return false
      }
    } else if (paymentDetails.paymentMethod === "Bank Transfer") {
      if (!paymentDetails.bankAccount) {
        toast({
          title: "Validation Error",
          description: "Please enter your bank account number",
          variant: "destructive"
        })
        return false
      }
    }

    // Validate documents - check if all required document types are uploaded
    const requiredDocumentTypes = [
      "Identity Proof (Aadhar/PAN)",
      "Address Proof"
    ]

    const uploadedTypes = documents.map(doc => doc.type)
    const missingDocuments = requiredDocumentTypes.filter(type => !uploadedTypes.includes(type))

    if (missingDocuments.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please upload the following required documents: ${missingDocuments.join(", ")}`,
        variant: "destructive"
      })
      return false
    }

    return true
  }

  const isFormComplete = () => {
    const detailsStatus = getTabCompletionStatus('details')
    const policyStatus = getTabCompletionStatus('policy')
    const beneficiariesStatus = getTabCompletionStatus('beneficiaries')
    const documentsStatus = getTabCompletionStatus('documents')
    const paymentStatus = getTabCompletionStatus('payment')

    return detailsStatus.completed === detailsStatus.total &&
           policyStatus.completed === policyStatus.total &&
           beneficiariesStatus.completed === beneficiariesStatus.total &&
           documentsStatus.completed === documentsStatus.total &&
           paymentStatus.completed === paymentStatus.total
  }

  const handleSubmit = async () => {
    if (!template) return

    if (!validateForm()) return

    setLoading(true)
    try {
      const formData = new FormData()
      
      // Add all form data
      formData.append('templateId', templateId)
      formData.append('customerDetails', JSON.stringify(customerDetails))
      formData.append('policyDetails', JSON.stringify(policyDetails))
      formData.append('beneficiaries', JSON.stringify(beneficiaries))
      formData.append('paymentDetails', JSON.stringify(paymentDetails))
      
      // Add documents
      documents.forEach((doc, index) => {
        formData.append(`document_${index}`, doc.file)
        formData.append(`document_type_${index}`, doc.type)
      })

      console.log('Submitting form with data:', {
        templateId,
        customerDetails,
        policyDetails,
        beneficiaries,
        paymentDetails,
        documentsCount: documents.length
      })

      const response = await apiClient.post('/policies/purchase-comprehensive', formData)

      console.log('API Response:', response)

      if (response.success) {
        toast({
          title: "Success",
          description: `Policy purchased successfully! Policy Number: ${response.data.policyNumber}`,
        })
        router.push('/dashboard/holder/policies')
      } else {
        throw new Error(response.error || 'Failed to purchase policy')
      }
    } catch (error: any) {
      console.error('Error purchasing policy:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response
      })
      
      let errorMessage = "Failed to purchase policy"
      
      if (error.message?.includes('No token provided')) {
        errorMessage = "Please log in again to continue"
      } else if (error.message?.includes('Invalid token')) {
        errorMessage = "Your session has expired. Please log in again"
      } else if (error.message?.includes('Policy template not found')) {
        errorMessage = "The selected policy is no longer available"
      } else if (error.message?.includes('Template expired')) {
        errorMessage = "This policy template has expired"
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (!template) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading policy template...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/holder/policies">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Policies
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Purchase Policy</h1>
          <p className="text-muted-foreground">
            Complete your insurance policy purchase
          </p>
        </div>
      </div>

      {/* Policy Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Policy Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-lg">{template.policy_type} Insurance</h3>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <p className="text-sm text-muted-foreground mt-2">Provider: {template.provider_name}</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coverage Amount:</span>
                <span className="font-medium">₹{template.coverage_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Premium:</span>
                <span className="font-medium">₹{template.premium.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Claims/Year:</span>
                <span className="font-medium">{template.max_claims_per_year}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry Date:</span>
                <span className="font-medium">{new Date(template.insurance_exp_date).toLocaleDateString()}</span>
              </div>
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Available
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Form */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <h3 className="font-medium text-blue-900">Important Notice</h3>
        </div>
        <p className="text-blue-800 text-sm mt-1">
          All fields marked with * are mandatory and must be completed before submitting the form. 
          Please ensure you have all required documents ready for upload.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="details" className="flex items-center gap-2">
            Customer Details
            {(() => {
              const status = getTabCompletionStatus('details')
              return status.completed === status.total ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">{status.completed}/{status.total}</span>
              )
            })()}
          </TabsTrigger>
          <TabsTrigger value="policy" className="flex items-center gap-2">
            Policy Details
            {(() => {
              const status = getTabCompletionStatus('policy')
              return status.completed === status.total ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">{status.completed}/{status.total}</span>
              )
            })()}
          </TabsTrigger>
          <TabsTrigger value="beneficiaries" className="flex items-center gap-2">
            Beneficiaries
            {(() => {
              const status = getTabCompletionStatus('beneficiaries')
              return status.completed === status.total ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">{status.completed}/{status.total}</span>
              )
            })()}
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            Documents
            {(() => {
              const status = getTabCompletionStatus('documents')
              return status.completed === status.total ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">{status.completed}/{status.total}</span>
              )
            })()}
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            Payment
            {(() => {
              const status = getTabCompletionStatus('payment')
              return status.completed === status.total ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">{status.completed}/{status.total}</span>
              )
            })()}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={customerDetails.fullName}
                    onChange={(e) => setCustomerDetails({...customerDetails, fullName: e.target.value})}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerDetails.email}
                    onChange={(e) => setCustomerDetails({...customerDetails, email: e.target.value})}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={customerDetails.phone}
                    onChange={(e) => setCustomerDetails({...customerDetails, phone: e.target.value})}
                    placeholder="Enter your phone number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aadharNumber">Aadhar Number *</Label>
                  <Input
                    id="aadharNumber"
                    value={customerDetails.aadharNumber}
                    onChange={(e) => setCustomerDetails({...customerDetails, aadharNumber: e.target.value})}
                    placeholder="Enter your Aadhar number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panNumber">PAN Number *</Label>
                  <Input
                    id="panNumber"
                    value={customerDetails.panNumber}
                    onChange={(e) => setCustomerDetails({...customerDetails, panNumber: e.target.value})}
                    placeholder="Enter your PAN number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={customerDetails.dateOfBirth}
                    onChange={(e) => setCustomerDetails({...customerDetails, dateOfBirth: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={customerDetails.gender} onValueChange={(value) => setCustomerDetails({...customerDetails, gender: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genders.map(gender => (
                        <SelectItem key={gender} value={gender}>{gender}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation *</Label>
                  <Input
                    id="occupation"
                    value={customerDetails.occupation}
                    onChange={(e) => setCustomerDetails({...customerDetails, occupation: e.target.value})}
                    placeholder="Enter your occupation"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annualIncome">Annual Income *</Label>
                  <Input
                    id="annualIncome"
                    type="number"
                    value={customerDetails.annualIncome}
                    onChange={(e) => setCustomerDetails({...customerDetails, annualIncome: e.target.value})}
                    placeholder="Enter your annual income"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={customerDetails.address}
                  onChange={(e) => setCustomerDetails({...customerDetails, address: e.target.value})}
                  placeholder="Enter your complete address"
                  rows={3}
                  required
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Policy Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="planName">Plan Name *</Label>
                  <Input
                    id="planName"
                    value={policyDetails.planName}
                    onChange={(e) => setPolicyDetails({...policyDetails, planName: e.target.value})}
                    placeholder="e.g., Family Floater, Individual Plan"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="membersCount">Number of Members *</Label>
                  <Input
                    id="membersCount"
                    type="number"
                    min="1"
                    value={policyDetails.membersCount}
                    onChange={(e) => setPolicyDetails({...policyDetails, membersCount: parseInt(e.target.value) || 1})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Policy Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={policyDetails.startDate}
                    onChange={(e) => setPolicyDetails({...policyDetails, startDate: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomineeName">Nominee Name *</Label>
                  <Input
                    id="nomineeName"
                    value={policyDetails.nomineeName}
                    onChange={(e) => setPolicyDetails({...policyDetails, nomineeName: e.target.value})}
                    placeholder="Enter nominee name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomineeRelationship">Nominee Relationship *</Label>
                  <Select value={policyDetails.nomineeRelationship} onValueChange={(value) => setPolicyDetails({...policyDetails, nomineeRelationship: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      {relationships.map(rel => (
                        <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomineePhone">Nominee Phone *</Label>
                  <Input
                    id="nomineePhone"
                    value={policyDetails.nomineePhone}
                    onChange={(e) => setPolicyDetails({...policyDetails, nomineePhone: e.target.value})}
                    placeholder="Enter nominee phone number"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="beneficiaries" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Policy Beneficiaries
              </CardTitle>
              <Button onClick={addBeneficiary} size="sm">
                Add Beneficiary
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {beneficiaries.map((beneficiary, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Beneficiary {index + 1}</h4>
                    {beneficiaries.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeBeneficiary(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={beneficiary.name}
                        onChange={(e) => updateBeneficiary(index, 'name', e.target.value)}
                        placeholder="Enter beneficiary name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship *</Label>
                      <Select value={beneficiary.relationship} onValueChange={(value) => updateBeneficiary(index, 'relationship', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {relationships.map(rel => (
                            <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Age *</Label>
                      <Input
                        type="number"
                        value={beneficiary.age}
                        onChange={(e) => updateBeneficiary(index, 'age', parseInt(e.target.value) || 0)}
                        placeholder="Enter age"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender *</Label>
                      <Select value={beneficiary.gender} onValueChange={(value) => updateBeneficiary(index, 'gender', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {genders.map(gender => (
                            <SelectItem key={gender} value={gender}>{gender}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Aadhar Number *</Label>
                      <Input
                        value={beneficiary.aadhar_number}
                        onChange={(e) => updateBeneficiary(index, 'aadhar_number', e.target.value)}
                        placeholder="Enter Aadhar number"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth *</Label>
                      <Input
                        type="date"
                        value={beneficiary.date_of_birth}
                        onChange={(e) => updateBeneficiary(index, 'date_of_birth', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Required Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documentTypes.map((type) => (
                  <div key={type} className="space-y-2">
                    <Label>{type} *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleDocumentUpload(type, e.target.files[0])
                          }
                        }}
                        className="w-full"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {documents.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Uploaded Documents</h4>
                  <div className="space-y-2">
                    {documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium">{doc.type}</p>
                            <p className="text-sm text-muted-foreground">{doc.file.name}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeDocument(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <Select value={paymentDetails.paymentMethod} onValueChange={(value) => setPaymentDetails({...paymentDetails, paymentMethod: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(method => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {paymentDetails.paymentMethod === "Credit Card" || paymentDetails.paymentMethod === "Debit Card" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Card Number *</Label>
                      <Input
                        value={paymentDetails.cardNumber}
                        onChange={(e) => setPaymentDetails({...paymentDetails, cardNumber: e.target.value})}
                        placeholder="1234 5678 9012 3456"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date *</Label>
                      <Input
                        value={paymentDetails.expiryDate}
                        onChange={(e) => setPaymentDetails({...paymentDetails, expiryDate: e.target.value})}
                        placeholder="MM/YY"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CVV *</Label>
                      <Input
                        value={paymentDetails.cvv}
                        onChange={(e) => setPaymentDetails({...paymentDetails, cvv: e.target.value})}
                        placeholder="123"
                        required
                      />
                    </div>
                  </div>
                ) : paymentDetails.paymentMethod === "UPI" ? (
                  <div className="space-y-2">
                    <Label>UPI ID *</Label>
                    <Input
                      value={paymentDetails.upiId}
                      onChange={(e) => setPaymentDetails({...paymentDetails, upiId: e.target.value})}
                      placeholder="yourname@paytm"
                      required
                    />
                  </div>
                ) : paymentDetails.paymentMethod === "Bank Transfer" ? (
                  <div className="space-y-2">
                    <Label>Bank Account Number *</Label>
                    <Input
                      value={paymentDetails.bankAccount}
                      onChange={(e) => setPaymentDetails({...paymentDetails, bankAccount: e.target.value})}
                      placeholder="Enter bank account number"
                      required
                    />
                  </div>
                ) : null}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Payment Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Premium Amount:</span>
                    <span className="font-medium">₹{template.premium.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (18%):</span>
                    <span className="font-medium">₹{(template.premium * 0.18).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Amount:</span>
                    <span>₹{(template.premium * 1.18).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Link href="/dashboard/holder/policies">
          <Button variant="outline">
            Cancel
          </Button>
        </Link>
        <Button 
          onClick={handleSubmit} 
          disabled={loading || !isFormComplete()}
          className={`${isFormComplete() ? 'bg-[#07a6ec] hover:bg-[#0696d7]' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : isFormComplete() ? (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Complete Purchase
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 mr-2" />
              Complete All Fields First
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

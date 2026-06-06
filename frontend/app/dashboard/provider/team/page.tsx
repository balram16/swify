"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  Award,
  Star,
  RefreshCw
} from "lucide-react"
import apiClient from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

export default function TeamPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [teamData, setTeamData] = useState({
    stats: {
      totalMembers: 1,
      activeMembers: 1,
      pendingInvites: 0,
      departments: 1,
      avgPerformance: 100
    },
    departments: {
      management: {
        name: "Management",
        members: 1,
        lead: "You",
        performance: 100,
        metrics: {
          avgProcessingTime: "N/A",
          accuracyRate: "100%",
          customerSatisfaction: 5.0
        }
      }
    },
    members: [] as any[],
    performance: {
      topPerformers: [] as any[],
      recentAchievements: [] as any[]
    }
  })

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/auth/profile')
      if (res.success && res.data) {
        const user = res.data

        const me = {
          id: `EMP-${user.user_id}`,
          name: user.full_name || "Provider",
          role: "Provider Admin",
          department: "Management",
          email: user.email,
          phone: user.phone || "N/A",
          joinDate: user.created_at || new Date().toISOString(),
          status: "Active",
          performance: {
            accuracy: 100
          },
          certifications: ["Admin"],
          photo: "https://i.pravatar.cc/150?img=44"
        }

        setTeamData(prev => ({
          ...prev,
          members: [me],
          performance: {
            topPerformers: [
              {
                name: me.name,
                metric: "100% Processing Accuracy",
                achievement: "Top Performer"
              }
            ],
            recentAchievements: []
          }
        }))
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast({ title: "Error", description: "Failed to load team data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  if (loading) {
    return (
      <div className="p-8 space-y-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading team data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">
            Manage team members and track performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={fetchProfile} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button className="bg-[#07a6ec] hover:bg-[#0696d7]">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <h3 className="text-2xl font-bold">{teamData.stats.totalMembers}</h3>
                <p className="text-sm text-green-600">
                  {teamData.stats.activeMembers} active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Star className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Performance</p>
                <h3 className="text-2xl font-bold">{teamData.stats.avgPerformance}%</h3>
                <p className="text-sm text-green-600">Stable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search team members..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <TabsContent value="overview">
          {/* Department Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Department Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(teamData.departments).map(([key, dept]) => (
                  <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{dept.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {dept.members} members • Led by {dept.lead}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">Performance</p>
                        <p className="text-sm text-green-600">{dept.performance}%</p>
                      </div>
                      <Button variant="outline">View Team</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamData.performance.topPerformers.map((performer, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Award className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{performer.name}</h4>
                      <p className="text-sm text-muted-foreground">{performer.metric}</p>
                    </div>
                    <Badge className="ml-auto bg-green-100 text-green-800">
                      {performer.achievement}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <div className="space-y-4">
            {teamData.members.length > 0 ? teamData.members.map(member => (
              <Card key={member.id}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-6">
                    <Image
                      src={member.photo}
                      alt={member.name}
                      width={64}
                      height={64}
                      className="rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{member.name}</h3>
                        <Badge variant="outline">{member.id}</Badge>
                        <Badge className="bg-green-100 text-green-800">
                          {member.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.role} • {member.department}
                      </div>
                      <div className="mt-2 flex gap-4">
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span className="text-sm">{member.email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          <span className="text-sm">{member.phone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline">View Profile</Button>
                      <Button className="bg-[#07a6ec]">Manage Access</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No team members found.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="departments">
          <div className="text-center py-8">
            <p className="text-muted-foreground">More department statistics will be available soon.</p>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="text-center py-8">
            <p className="text-muted-foreground">More performance statistics will be available soon.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
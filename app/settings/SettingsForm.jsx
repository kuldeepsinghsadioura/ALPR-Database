'use client'

import React, { useState } from "react"
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useForm } from 'react-hook-form'
import { saveSettings, regenerateApiKey, changePassword } from '@/app/actions'
import DashboardLayout from "@/components/layout/MainLayout"

const navigation = [
  { title: "General", id: "general" },
  { title: "MQTT/HTTP", id: "mqtt" },
  { title: "Database", id: "database" },
  { title: "Push Notifications", id: "push" },
  { title: "Security", id: "security" }
]

export default function SettingsForm({ initialSettings, initialApiKey }) {
  const [activeSection, setActiveSection] = useState("general")
  const [isSaving, setIsSaving] = useState(false)
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm({
    defaultValues: {
      maxRecords: initialSettings.general.maxRecords,
      ignoreNonPlate: initialSettings.general.ignoreNonPlate,
      mqttBroker: initialSettings.mqtt.broker,
      mqttTopic: initialSettings.mqtt.topic,
      dbHost: initialSettings.database.host,
      dbName: initialSettings.database.name,
      dbUser: initialSettings.database.user,
      dbPassword: initialSettings.database.password,
      pushServer: initialSettings.push.server,
      pushCredentials: initialSettings.push.credentials
    }
  })

  const onSubmit = async (data) => {
    setIsSaving(true)
    const result = await saveSettings(data)
    setIsSaving(false)
    if (result.success) {
    } else {
      alert('Error saving settings: ' + result.error)
    }
  }

  const handlePasswordChange = async () => {
    const formData = getValues()
    
    // Validate password fields
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      alert('All password fields are required')
      return
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      alert('New passwords do not match')
      return
    }

    if (formData.newPassword.length < 8) {
      alert('New password must be at least 8 characters long')
      return
    }

    const result = await changePassword(formData.currentPassword, formData.newPassword)
    if (result.success) {
      alert('Password changed successfully')
      setValue('currentPassword', '')
      setValue('newPassword', '')
      setValue('confirmPassword', '')
    } else {
      alert(result.error)
    }
  }

  const handleRegenerateApiKey = async () => {
    const result = await regenerateApiKey()
    if (result.success) {
      setApiKey(result.apiKey)
      setShowApiKey(true)
      setShowDialog(false)
    } else {
      alert(result.error)
    }
  }

  const renderSection = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">General Settings</h3>
            <div className="space-y-2">
              <Label htmlFor="maxRecords">Maximum number of records to keep</Label>
              <Input id="maxRecords" {...register('maxRecords')} type="number" placeholder="10000" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="ignoreNonPlate" {...register('ignoreNonPlate')} />
              <Label htmlFor="ignoreNonPlate">Ignore non-plate number OCR reads</Label>
            </div>
          </div>
        )

      case "mqtt":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">MQTT Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mqttBroker">MQTT Broker URL/IP</Label>
                <Input id="mqttBroker" {...register('mqttBroker')} placeholder="mqtt://example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqttTopic">MQTT Topic</Label>
                <Input id="mqttTopic" {...register('mqttTopic')} placeholder="alpr/plates" />
              </div>
            </div>
          </div>
        )

      case "database":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Database Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dbHost">Database Host & Port</Label>
                <Input id="dbHost" {...register('dbHost')} placeholder="localhost:5432" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbName">Database Name</Label>
                <Input id="dbName" {...register('dbName')} placeholder="alpr_db" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbUser">Database User</Label>
                <Input id="dbUser" {...register('dbUser')} placeholder="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbPassword">Database Password</Label>
                <Input id="dbPassword" {...register('dbPassword')} type="password" placeholder="••••••••" />
              </div>
            </div>
          </div>
        )

      case "push":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Push Notification Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pushServer">Push Notification Server</Label>
                <Input id="pushServer" {...register('pushServer')} placeholder="https://push.example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pushCredentials">Token or User Key</Label>
                <Input id="pushCredentials" {...register('pushCredentials')} type="password" placeholder="••••••••" />
              </div>
            </div>
          </div>
        )

      case "security":
        return (
          <div className="space-y-8">
            {/* Password Change Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    {...register('currentPassword')}
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...register('newPassword')}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...register('confirmPassword')}
                  />
                </div>
                <Button onClick={handlePasswordChange}>
                  Change Password
                </Button>
              </div>
            </div>

            {/* API Key Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">API Key Management</h3>
                <div className="space-y-4">
                    <div>
                    <Label>Current API Key</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    readOnly
                                    value={apiKey}
                                    type={showApiKey ? "text" : "password"}
                                />
                            </div>
                            <Button
                            variant="outline"
                            onClick={() => setShowApiKey(!showApiKey)}
                            size="icon"
                            >
                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                    </div>
                    </div>
                    
                    <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogTrigger asChild>
                        <Button
                        variant="destructive"
                        onClick={(e) => {
                            e.preventDefault(); // Prevent form submission
                            setShowDialog(true);
                        }}
                        >
                        Regenerate API Key
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                        <DialogTitle>Regenerate API Key</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to regenerate the API key? This will invalidate the current key and any systems using it will need to be updated.
                        </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRegenerateApiKey}
                        >
                            Regenerate
                        </Button>
                        </DialogFooter>
                    </DialogContent>
                    </Dialog>
                </div>
            </div>
          </div>



        )

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-screen flex-col py-4 px-6">
        <header className="border-b backdrop-blur">
          <div className="container flex h-14 items-center">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-medium">System Settings</h1>
            </div>
          </div>
          <nav className="container">
            <div className="flex space-x-6">
              {navigation.map((item) => (
                <div key={item.id} className="relative">
                  <a
                    onClick={() => setActiveSection(item.id)}
                    className={`flex h-14 items-center text-sm font-medium transition-colors hover:text-primary cursor-pointer ${
                      item.id === activeSection ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {item.title}
                  </a>
                  {item.id === activeSection && (
                    <div 
                      className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ease-in-out"
                      style={{ width: '100%' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </nav>
        </header>
        <div className="flex-1">
          <div className="py-6">
            <form onSubmit={handleSubmit(onSubmit)}>
              <Card className="w-full max-w-4xl">
                <CardHeader>
                  <CardTitle>ALPR Database Settings</CardTitle>
                  <CardDescription>Configure your ALPR database application settings</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderSection()}
                </CardContent>
                {activeSection !== 'security' && (
                  <CardFooter>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
'use client'

import React, { useState, useEffect } from "react"
import { ChevronDown } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useForm } from 'react-hook-form'
import { getConfig, saveConfig } from '@/app/actions'
import DashboardLayout from "@/components/layout/MainLayout"

const navigation = [
  { title: "General", id: "general" },
  { title: "MQTT/HTTP", id: "mqtt" },
  { title: "Database", id: "database" },
  { title: "Push Notifications", id: "push" }
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general")
  const [isSaving, setIsSaving] = useState(false)
  const { register, handleSubmit, setValue } = useForm()

  useEffect(() => {
    async function loadConfig() {
      const config = await getConfig()
      Object.entries(config).forEach(([key, value]) => {
        setValue(key, value)
      })
    }
    loadConfig()
  }, [setValue])

  const onSubmit = async (data) => {
    setIsSaving(true)
    const result = await saveConfig(data)
    setIsSaving(false)
    if (result.success) {
      alert('Settings saved successfully!')
    } else {
      alert('Error saving settings: ' + result.error)
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
                <Label htmlFor="dbHost">Database Host</Label>
                <Input id="dbHost" {...register('dbHost')} placeholder="localhost" />
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
                <Label htmlFor="pushCredentials">Push Notification Credentials</Label>
                <Input id="pushCredentials" {...register('pushCredentials')} type="password" placeholder="••••••••" />
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
                <CardFooter>
                    <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </CardFooter>
                </Card>
            </form>
            </div>
        </div>
        </div>
    </DashboardLayout>
  )
}
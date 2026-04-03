import React from 'react';
import { ArrowRight, Upload, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import type { InterviewRole, InterviewDifficulty } from '@/types';

interface InterviewSetupProps {
    selectedRole: InterviewRole;
    setSelectedRole: (role: InterviewRole) => void;
    customRole: string;
    setCustomRole: (role: string) => void;
    selectedDifficulty: InterviewDifficulty;
    setSelectedDifficulty: (diff: InterviewDifficulty) => void;
    interviewType: string;
    setInterviewType: (type: any) => void;
    companyName: string;
    setCompanyName: (name: string) => void;
    jobDescription: string;
    setJobDescription: (desc: string) => void;
    onStart: () => void;
    loading: boolean;
}

export const InterviewSetup: React.FC<InterviewSetupProps> = ({
    selectedRole, setSelectedRole,
    customRole, setCustomRole,
    selectedDifficulty, setSelectedDifficulty,
    interviewType, setInterviewType,
    companyName, setCompanyName,
    jobDescription, setJobDescription,
    onStart, loading
}) => {
    return (
        <div className="max-w-4xl mx-auto py-8 px-6">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-white mb-2">Configure Your Interview</h1>
                <p className="text-gray-400">Customize the session to match your target role</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                        <h2 className="text-xl font-semibold text-white mb-2">Role Details</h2>

                        <div className="space-y-2">
                            <Label className="text-gray-300">Target Role</Label>
                            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as InterviewRole)}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="frontend">Frontend Developer</SelectItem>
                                    <SelectItem value="backend">Backend Developer</SelectItem>
                                    <SelectItem value="fullstack">Fullstack Developer</SelectItem>
                                    <SelectItem value="devops">DevOps Engineer</SelectItem>
                                    <SelectItem value="data-scientist">Data Scientist</SelectItem>
                                    <SelectItem value="product-manager">Product Manager</SelectItem>
                                    <SelectItem value="custom">Custom Role</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedRole === 'custom' && (
                            <div className="space-y-2 animate-fade-in">
                                <Label className="text-gray-300">Role Title</Label>
                                <Input
                                    value={customRole}
                                    onChange={(e) => setCustomRole(e.target.value)}
                                    placeholder="e.g. Mobile Developer"
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-gray-300">Experience Level</Label>
                            <Select value={selectedDifficulty} onValueChange={(v) => setSelectedDifficulty(v as InterviewDifficulty)}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="junior">Junior (0-2 years)</SelectItem>
                                    <SelectItem value="mid">Mid-Level (2-5 years)</SelectItem>
                                    <SelectItem value="senior">Senior (5+ years)</SelectItem>
                                    <SelectItem value="lead">Lead / Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-300">Interview Type</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['behavioral', 'technical', 'mixed'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setInterviewType(type)}
                                        className={`p-2 rounded-lg text-sm border transition-all ${interviewType === type
                                            ? 'bg-green-500/20 border-green-500/50 text-white'
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="capitalize">{type}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <Button
                        onClick={onStart}
                        disabled={loading || (selectedRole === 'custom' && !customRole)}
                        className="w-full h-12 text-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/20"
                    >
                        {loading ? 'Generating Questions...' : 'Start Interview Simulation'}
                        {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
                    </Button>
                </div>

                <div className="space-y-6">
                    <Card className="bg-white/5 border-white/10 p-6 space-y-4">
                        <h2 className="text-xl font-semibold text-white mb-2">Context (Optional)</h2>

                        <div className="space-y-2">
                            <Label className="text-gray-300">Target Company</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <Input
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g. Google, Startup Inc."
                                    className="pl-9 bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-300">Job Description</Label>
                            <Textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the job description here to tailor questions..."
                                className="bg-white/5 border-white/10 text-white min-h-[100px]"
                            />
                        </div>

                        <div className="p-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-center">
                            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-300">Upload Resume (PDF/TXT)</p>
                            <p className="text-xs text-gray-500 mt-1">Coming soon...</p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
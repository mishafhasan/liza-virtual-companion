import React from 'react';
import { useInterviewSession } from '@/hooks/useInterviewSession';
import { InterviewSetup } from '@/components/features/interview/InterviewSetup';
import { InterviewSessionView } from '@/components/features/interview/InterviewSessionView';
import { InterviewSummary } from '@/components/features/interview/InterviewSummary';

export const InterviewPage: React.FC = () => {
    const {
        view,
        selectedRole, setSelectedRole,
        customRole, setCustomRole,
        selectedDifficulty, setSelectedDifficulty,
        interviewType, setInterviewType,
        companyName, setCompanyName,
        jobDescription, setJobDescription,
        resumeText, setResumeText,
        input, setInput,
        currentSession,
        loading,
        elapsedTime,
        showFeedback,
        currentFeedback,
        startSession,
        submitAnswer,
        nextQuestion,
    } = useInterviewSession();

    if (view === 'setup') {
        return (
            <div className="min-h-[calc(100vh-65px)] bg-slate-950 flex items-center justify-center">
                <InterviewSetup
                    selectedRole={selectedRole}
                    setSelectedRole={setSelectedRole}
                    customRole={customRole}
                    setCustomRole={setCustomRole}
                    selectedDifficulty={selectedDifficulty}
                    setSelectedDifficulty={setSelectedDifficulty}
                    interviewType={interviewType}
                    setInterviewType={setInterviewType}
                    companyName={companyName}
                    setCompanyName={setCompanyName}
                    jobDescription={jobDescription}
                    setJobDescription={setJobDescription}
                    resumeText={resumeText}
                    setResumeText={setResumeText}
                    onStart={startSession}
                    loading={loading}
                />
            </div>
        );
    }

    if (view === 'session') {
        return (
            <InterviewSessionView
                session={currentSession}
                input={input}
                setInput={setInput}
                onSubmit={submitAnswer}
                onNext={nextQuestion}
                showFeedback={showFeedback}
                currentFeedback={currentFeedback}
                loading={loading}
                elapsedTime={elapsedTime}
            />
        );
    }

    if (view === 'summary') {
        return (
            <div className="min-h-[calc(100vh-65px)] bg-slate-950">
                <InterviewSummary
                    session={currentSession!}
                    onRestart={() => window.location.reload()}
                />
            </div>
        );
    }

    return null;
};

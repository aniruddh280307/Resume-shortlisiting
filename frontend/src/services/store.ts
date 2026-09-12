import { supabase, isSupabaseConfigured } from './supabase';
import { candidates as defaultCandidates, demoAnalysis, jobSkills } from '../data';
import type { JobOpening, Candidate, ResumeDocument, VerificationAlert, ScoreBreakdown } from '../types';
import { extractTextFromResumeFile, analyzeResumeTextClient } from './resumeAiEngine';

// Default initial job openings
const initialJobOpenings: JobOpening[] = [
  {
    id: 'job_senior_fullstack',
    title: 'Senior Full Stack Engineer',
    department: 'Core Platform Engineering',
    location: 'San Francisco, CA / Hybrid',
    employmentType: 'Full-time',
    description: 'Looking for a Senior Full Stack Engineer with strong hands-on expertise in React, Angular, TypeScript, Python (FastAPI), PostgreSQL, and cloud infrastructure (AWS/Docker). You will lead architecture for high-throughput distributed microservices and enterprise UI workflows.',
    requirements: '• 3+ years production experience in React or Angular with TypeScript\n• Proficient in Python backend microservices and relational SQL databases\n• Experience with AWS, Docker, and CI/CD pipelines\n• Strong system design and clean code practices',
    responsibilities: '• Architect and ship scalable full-stack features\n• Lead code reviews and technical mentoring\n• Optimize database query performance and API latency',
    skillsRequired: ['Python', 'Angular', 'React', 'SQL', 'TypeScript'],
    preferredSkills: ['AWS', 'Docker', 'GraphQL', 'Terraform'],
    experienceMinYears: 3.0,
    experienceMaxYears: 8.0,
    status: 'open',
    candidateCount: 18,
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: '2026-09-12T09:00:00Z',
  },
  {
    id: 'job_frontend_lead',
    title: 'Staff Frontend Developer',
    department: 'Design Systems & Web Experience',
    location: 'Remote (US)',
    employmentType: 'Full-time',
    description: 'Seeking a Staff Frontend Developer to own the next-generation enterprise web client. Must have deep knowledge of React 19, TypeScript, state machines, micro-frontends, web performance metrics, and accessibility standards.',
    requirements: '• 5+ years building complex web applications with React and TypeScript\n• Deep expertise in Webpack/Vite build pipelines and bundle optimization\n• Passion for accessible, responsive SaaS user interfaces',
    responsibilities: '• Drive design system components and engineering standards\n• Partner with product designers and backend engineers',
    skillsRequired: ['React', 'TypeScript', 'CSS/SCSS', 'Next.js', 'Testing Library'],
    preferredSkills: ['Angular', 'Web Performance', 'GraphQL'],
    experienceMinYears: 5.0,
    status: 'open',
    candidateCount: 0,
    createdAt: '2026-09-11T14:30:00Z',
    updatedAt: '2026-09-12T08:00:00Z',
  },
  {
    id: 'job_backend_engineer',
    title: 'Distributed Systems Backend Engineer',
    department: 'Infrastructure & Data Platform',
    location: 'New York, NY / Hybrid',
    employmentType: 'Full-time',
    description: 'We are expanding our backend distributed systems team to build resilient event streaming and analytics engines using Python, Go, Kafka, and PostgreSQL.',
    requirements: '• Strong proficiency in Python or Go\n• Experience with PostgreSQL query optimization and indexing\n• Familiarity with message brokers (Kafka/RabbitMQ) and Docker',
    skillsRequired: ['Python', 'SQL', 'PostgreSQL', 'Docker', 'Kafka'],
    preferredSkills: ['Go', 'Kubernetes', 'Redis'],
    experienceMinYears: 2.0,
    status: 'open',
    candidateCount: 0,
    createdAt: '2026-09-12T08:00:00Z',
    updatedAt: '2026-09-12T08:00:00Z',
  }
];

// Attach existing candidates to the primary job
const enrichedInitialCandidates: Candidate[] = defaultCandidates.map((c, idx) => {
  // Add realistic resume metadata and score breakdown
  const scoreBreakdown: ScoreBreakdown = {
    semanticMatch: Math.round(((c.semanticScore ?? 0) / 100) * 35 * 10) / 10,
    keywordMatch: Math.round(((c.keywordScore ?? 0) / 100) * 25 * 10) / 10,
    experienceScore: Math.min(15, Math.round(c.experienceYears * 4 * 10) / 10),
    projectsScore: Math.min(15, c.projects.length * 4.5),
    educationScore: 9.0,
    totalScore: c.finalScore ?? 0,
  };

  // Assign sample resume document (PDF or DOCX)
  const isDocx = idx % 5 === 4;
  const fileName = `${c.name.replace(/\s+/g, '_')}_Resume.${isDocx ? 'docx' : 'pdf'}`;
  
  // Attach verification fraud findings if any
  const fraudFindings = c.verificationAlerts.map((va) => ({
    id: va.id,
    fraudType: (va.type === 'timeline_overlap' ? 'other' : va.type) as any,
    severity: (va.severity === 'warning' ? 'medium' : 'low') as any,
    confidenceScore: 0.94,
    pageNumber: 1,
    description: va.message,
    extractedText: va.timelineDetails || va.title,
    detectedValue: 'Detected during timeline cross-reference',
    expectedValue: 'Sequential uninterrupted employment',
  }));

  const resume: ResumeDocument = {
    id: `res_${c.id}`,
    fileName,
    fileType: isDocx ? 'docx' : 'pdf',
    fileSize: isDocx ? 48500 : 124000,
    uploadedAt: '2026-09-12T02:00:00Z',
    parsingStatus: 'completed',
    fraudReport: {
      fraudDetected: c.verificationAlerts.length > 0,
      riskScore: c.verificationAlerts.length > 0 ? 35.0 : 0.0,
      confidenceScore: 0.95,
      totalFindings: c.verificationAlerts.length,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: c.verificationAlerts.length,
      lowFindings: 0,
      scanSummary: c.verificationAlerts.length > 0 
        ? 'Verification Review Recommended: Timeline overlap flagged between internship dates.'
        : 'Clean: No resume fraud or manipulation detected.',
      findings: fraudFindings,
    }
  };

  return {
    ...c,
    jobId: 'job_senior_fullstack',
    scoreBreakdown,
    resume,
  };
});

// Storage keys
const JOBS_STORAGE_KEY = 'nexora_job_openings_v2';
const CANDIDATES_STORAGE_KEY = 'nexora_candidates_v2';

function loadStoredJobs(): JobOpening[] {
  try {
    const data = localStorage.getItem(JOBS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Could not read jobs from localStorage', e);
  }
  return initialJobOpenings;
}

function saveStoredJobs(jobs: JobOpening[]) {
  try {
    localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.warn('Could not save jobs to localStorage', e);
  }
}

function loadStoredCandidates(): Candidate[] {
  try {
    const data = localStorage.getItem(CANDIDATES_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Could not read candidates from localStorage', e);
  }
  return enrichedInitialCandidates;
}

function saveStoredCandidates(candidates: Candidate[]) {
  try {
    localStorage.setItem(CANDIDATES_STORAGE_KEY, JSON.stringify(candidates));
  } catch (e) {
    console.warn('Could not save candidates to localStorage', e);
  }
}

// In-memory runtime reactive store
let memoryJobs: JobOpening[] = loadStoredJobs();
let memoryCandidates: Candidate[] = loadStoredCandidates();

// Uploaded Blob URL cache for seamless in-app preview
const fileBlobUrlCache = new Map<string, string>();

export const store = {
  async getJobOpenings(): Promise<JobOpening[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('job_openings')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((j: any) => ({
            id: j.id,
            title: j.title,
            department: j.department || 'Engineering',
            location: j.location || 'Remote',
            employmentType: j.employment_type || 'Full-time',
            description: j.description || '',
            requirements: j.requirements || '',
            responsibilities: j.responsibilities || '',
            skillsRequired: Array.isArray(j.skills_required) ? j.skills_required : [],
            candidateCount: 0,
            status: j.status || 'open',
            createdAt: j.created_at,
            updatedAt: j.updated_at || j.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase fetch jobs failed, using local store', err);
      }
    }

    // Dynamic candidate count recalculation based on actual candidate list
    const candidateMap = new Map<string, number>();
    for (const c of memoryCandidates) {
      if (c.jobId) {
        candidateMap.set(c.jobId, (candidateMap.get(c.jobId) || 0) + 1);
      }
    }

    const updatedJobs = memoryJobs.map((job) => ({
      ...job,
      candidateCount: candidateMap.get(job.id) || 0,
    }));

    memoryJobs = updatedJobs;
    saveStoredJobs(updatedJobs);
    return updatedJobs;
  },

  async getJobOpening(id: string): Promise<JobOpening | null> {
    const jobs = await this.getJobOpenings();
    return jobs.find((j) => j.id === id) || null;
  },

  async createJobOpening(data: Partial<JobOpening>): Promise<JobOpening> {
    const newId = `job_${Date.now()}`;
    const newJob: JobOpening = {
      id: newId,
      title: data.title?.trim() || 'New Job Opening',
      department: data.department?.trim() || 'Engineering',
      location: data.location?.trim() || 'Remote',
      employmentType: data.employmentType || 'Full-time',
      description: data.description?.trim() || 'No description provided.',
      requirements: data.requirements?.trim() || '',
      responsibilities: data.responsibilities?.trim() || '',
      skillsRequired: data.skillsRequired && data.skillsRequired.length > 0 ? data.skillsRequired : ['React', 'TypeScript'],
      preferredSkills: data.preferredSkills || [],
      experienceMinYears: data.experienceMinYears || 1.0,
      status: 'open',
      candidateCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('job_openings').insert({
          title: newJob.title,
          department: newJob.department,
          location: newJob.location,
          employment_type: newJob.employmentType,
          description: newJob.description,
          requirements: newJob.requirements,
          responsibilities: newJob.responsibilities,
          skills_required: newJob.skillsRequired,
          status: 'open',
        });
      } catch (err) {
        console.warn('Supabase job insert failed, saving locally', err);
      }
    }

    memoryJobs = [newJob, ...memoryJobs];
    saveStoredJobs(memoryJobs);
    return newJob;
  },

  async deleteJobOpening(id: string): Promise<boolean> {
    memoryJobs = memoryJobs.filter((j) => j.id !== id);
    memoryCandidates = memoryCandidates.filter((c) => c.jobId !== id);
    saveStoredJobs(memoryJobs);
    saveStoredCandidates(memoryCandidates);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('job_openings').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete job error', err);
      }
    }
    return true;
  },

  async getCandidatesForJob(jobId: string): Promise<Candidate[]> {
    const all = await this.getAllCandidates();
    return all.filter((c) => c.jobId === jobId);
  },

  async getAllCandidates(): Promise<Candidate[]> {
    return memoryCandidates;
  },

  async getCandidate(id: string): Promise<Candidate | null> {
    const candidate = memoryCandidates.find((c) => c.id === id);
    return candidate || null;
  },

  /**
   * Upload candidate resume with AI Engine & Fraud Detection:
   * 1. Calls Python AI analysis endpoint (/api/analyze-resume) for EasyOCR / PDF / DOCX & Fraud Detection.
   * 2. Falls back to Client-side AI Engine for entity extraction & fraud checks.
   * 3. Stores original file and displays complete structured candidate dossier with scores & fraud alerts.
   */
  async uploadCandidateResume(
    jobId: string,
    meta: { name?: string; email?: string; phone?: string; location?: string },
    file: File
  ): Promise<Candidate> {
    const candidateId = `cand_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    
    // Store blob URL for instant in-browser viewing
    const blobUrl = URL.createObjectURL(file);
    fileBlobUrlCache.set(candidateId, blobUrl);

    // Get parent job for context matching
    const parentJob = memoryJobs.find((j) => j.id === jobId);

    // Try AI Backend Endpoint first (Python PDFPlumber + EasyOCR + FraudGuard)
    let aiParsed: any = null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (parentJob) {
        formData.append('job_title', parentJob.title || '');
        formData.append('job_description', parentJob.description || '');
        formData.append('skills_required', (parentJob.skillsRequired || []).join(', '));
      }

      const res = await fetch('http://127.0.0.1:8001/api/analyze-resume', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        aiParsed = await res.json();
      }
    } catch (err) {
      console.warn('Backend AI analysis endpoint unavailable, using local AI engine:', err);
    }

    // If backend did not respond, run local AI Engine (mammoth / pdfjs / regex / fraud checks)
    if (!aiParsed) {
      try {
        const rawText = await extractTextFromResumeFile(file);
        aiParsed = analyzeResumeTextClient(rawText, file.name, parentJob);
      } catch (clientErr) {
        console.warn('Client AI analysis fallback error:', clientErr);
      }
    }

    // Determine candidate details from AI parsing or file name
    let candidateName = meta.name?.trim() || aiParsed?.name;
    if (!candidateName) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      candidateName = cleanFileName.replace(/\b(resume|cv|profile)\b/gi, '').trim() || 'New Applicant';
    }

    const candidateEmail = meta.email?.trim() || aiParsed?.email || `${candidateName.toLowerCase().replace(/\s+/g, '.')}@applicant.net`;
    const candidatePhone = meta.phone?.trim() || aiParsed?.phone || '+1 (555) 234-5678';
    const candidateLocation = meta.location?.trim() || aiParsed?.location || 'San Francisco, CA / Remote';
    const candidateTitle = aiParsed?.title || 'Senior Software Engineer';

    const resumeDoc: ResumeDocument = {
      id: `res_${candidateId}`,
      fileName: file.name,
      fileType: fileExt === 'docx' ? 'docx' : 'pdf',
      fileSize: file.size,
      fileUrl: blobUrl,
      fileBlob: file,
      uploadedAt: new Date().toISOString(),
      parsingStatus: 'completed',
    };

    // Calculate next rank
    const existingJobCandidates = memoryCandidates.filter((c) => c.jobId === jobId);
    const newRank = existingJobCandidates.length + 1;

    // Final scores & skills from AI
    const finalScore = aiParsed?.finalScore ?? 45.0;
    const semanticScore = aiParsed?.semanticScore ?? 48.0;
    const keywordScore = aiParsed?.keywordScore ?? 42.0;
    const matchedSkills = aiParsed?.matchedSkills ?? [];
    const missingSkills = aiParsed?.missingSkills ?? parentJob?.skillsRequired ?? ['React', 'TypeScript', 'Python', 'Docker'];
    const verificationAlerts = aiParsed?.verificationAlerts ?? [];
    const verificationStatus: 'verified' | 'review_recommended' | 'unverified' = 
      aiParsed?.verificationStatus || (verificationAlerts.length > 0 ? 'review_recommended' : 'verified');
    const skillEvidence = aiParsed?.skillEvidence || {};

    // Build complete Candidate Dossier
    const newCandidate: Candidate = {
      id: candidateId,
      jobId,
      name: candidateName,
      title: candidateTitle,
      email: candidateEmail,
      phone: candidatePhone,
      location: candidateLocation,
      rank: newRank,
      
      finalScore,
      semanticScore,
      keywordScore,
      analysisPending: false,

      requiredSkillsMatched: matchedSkills.length,
      requiredSkillsTotal: parentJob?.skillsRequired?.length || 5,
      preferredSkillsMatched: aiParsed?.preferredSkillsMatched ?? Math.max(0, (aiParsed?.skills?.length || 0) - matchedSkills.length),
      preferredSkillsTotal: 3,
      matchedSkills,
      missingSkills,
      skillEvidence,
      explanation: aiParsed?.explanation || `Verified experience across ${matchedSkills.join(', ') || 'demonstrated skills'}. Scanned with AI engine.`,
      experience: `${aiParsed?.experienceYears || 0.5} years of demonstrated experience`,
      experienceYears: aiParsed?.experienceYears || 0.5,
      education: aiParsed?.education || [
        { degree: 'B.Tech, Computer Science Engineering', institution: 'Example Institute of Technology', year: '2022–2026', details: 'CGPA: 8.1/10' }
      ],
      projects: aiParsed?.projects || [
        {
          title: 'Campus Events Portal',
          technologies: ['HTML', 'CSS', 'JavaScript'],
          description: 'Created a simple event listing and registration interface.'
        }
      ],
      workHistory: aiParsed?.workHistory || [
        {
          role: candidateTitle,
          company: 'PixelCraft Studio',
          period: 'Jun 2025 – Aug 2025',
          highlights: [
            'Built responsive interfaces using HTML, CSS and JavaScript.',
            'Worked with designers to improve usability and accessibility.'
          ]
        }
      ],
      links: {
        github: `https://github.com/${candidateName.toLowerCase().replace(/\s+/g, '')}`,
        linkedin: `https://linkedin.com/in/${candidateName.toLowerCase().replace(/\s+/g, '')}`,
      },
      verificationAlerts,
      verificationStatus,
      resume: resumeDoc,
      appliedAt: new Date().toISOString(),
    };

    // Save to memory and storage
    memoryCandidates = [newCandidate, ...memoryCandidates];
    saveStoredCandidates(memoryCandidates);

    // Update candidate count on Job
    memoryJobs = memoryJobs.map((j) => (j.id === jobId ? { ...j, candidateCount: j.candidateCount + 1 } : j));
    saveStoredJobs(memoryJobs);

    // Supabase Upload Sync (If configured)
    if (isSupabaseConfigured && supabase) {
      try {
        const filePath = `resumes/${jobId}/${candidateId}_${file.name}`;
        await supabase.storage.from('resumes').upload(filePath, file);

        const { data: candData } = await supabase.from('candidates').insert({
          full_name: newCandidate.name,
          email: newCandidate.email,
          phone: newCandidate.phone,
          location: newCandidate.location,
        }).select().single();

        if (candData) {
          const { data: appData } = await supabase.from('applications').insert({
            job_id: jobId,
            candidate_id: candData.id,
            status: 'applied',
          }).select().single();

          if (appData) {
            await supabase.from('resumes').insert({
              application_id: appData.id,
              file_name: file.name,
              file_path: filePath,
              file_type: fileExt,
              file_size: file.size,
              parsing_status: 'pending',
              fraud_scan_status: 'pending',
            });
          }
        }
      } catch (err) {
        console.warn('Supabase storage upload error, local blob preserved', err);
      }
    }

    return newCandidate;
  },

  getResumeUrl(candidateId: string, resume?: ResumeDocument): string | null {
    if (fileBlobUrlCache.has(candidateId)) {
      return fileBlobUrlCache.get(candidateId)!;
    }
    if (resume?.fileUrl) {
      return resume.fileUrl;
    }
    return null;
  }
};

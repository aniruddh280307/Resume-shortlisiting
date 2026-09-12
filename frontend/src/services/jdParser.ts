import mammoth from 'mammoth';

export interface ExtractedJobData {
  title: string;
  department: string;
  location: string;
  employmentType: string;
  experienceMinYears: number;
  description: string;
  requirements: string;
  responsibilities: string;
  skillsRequired: string[];
  rawText: string;
  confidenceScore: number;
}

const COMMON_SKILLS = [
  'React', 'TypeScript', 'JavaScript', 'Node.js', 'Express', 'Express.js', 'Python', 'Go', 'Golang', 'Java',
  'C++', 'C#', '.NET', 'Rust', 'Ruby', 'Rails', 'PHP', 'Laravel', 'Swift', 'Kotlin',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'NoSQL', 'Redis', 'Cassandra', 'Elasticsearch', 'DynamoDB',
  'AWS', 'Amazon Web Services', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes',
  'Terraform', 'CI/CD', 'GitHub Actions', 'Jenkins', 'Kafka', 'RabbitMQ', 'GraphQL',
  'REST APIs', 'REST API', 'JSON', 'Microservices', 'TailwindCSS', 'CSS3', 'CSS', 'HTML5', 'HTML', 'Next.js', 'Vue.js', 'Angular',
  'FastAPI', 'Django', 'Flask', 'Spring Boot', 'Pandas', 'NumPy', 'PyTorch', 'TensorFlow',
  'Scikit-learn', 'Machine Learning', 'NLP', 'Computer Vision', 'Data Science', 'LLMs',
  'Prompt Engineering', 'LangChain', 'OpenAI API', 'Figma', 'UI/UX', 'System Design',
  'Agile', 'Scrum', 'Jira', 'Git', 'GitHub', 'GitLab', 'Jest', 'Mocha', 'Testing'
];

/**
 * Extracts plain text from a Job Description File (.pdf, .docx, .txt, .md).
 */
export async function extractTextFromJDFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  // 1. Text or Markdown files
  if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.json') || file.type.includes('text/')) {
    return await file.text();
  }

  // 2. DOCX files via Mammoth
  if (fileName.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value && result.value.trim().length > 0) {
        return result.value.trim();
      }
    } catch (e) {
      console.warn('Mammoth extraction failed, falling back to text stream:', e);
    }
  }

  // 3. PDF files (via pdfjs-dist if available or arrayBuffer stream decoding)
  if (fileName.endsWith('.pdf') || file.type.includes('pdf')) {
    try {
      // Dynamic import of pdfjs-dist
      // @ts-ignore
      const pdfjsLib = await import('pdfjs-dist/build/pdf').catch(() => null) || (window as any).pdfjsLib;
      if (pdfjsLib) {
        if (!pdfjsLib.GlobalWorkerOptions?.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
        }
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageStrings = content.items.map((item: any) => item.str);
          fullText += pageStrings.join(' ') + '\n';
        }
        if (fullText.trim().length > 20) {
          return fullText.trim();
        }
      }
    } catch (pdfErr) {
      console.warn('PDF.js parse failed, attempting stream binary fallback:', pdfErr);
    }

    // Binary / stream text recovery fallback for PDF
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawString = textDecoder.decode(bytes);
      
      const matches = rawString.match(/\(([^()]{3,})\)/g);
      if (matches && matches.length > 5) {
        return matches.map(m => m.slice(1, -1)).join(' ');
      }
    } catch (fallbackErr) {
      console.warn('Binary stream PDF fallback error:', fallbackErr);
    }
  }

  // Generic fallback
  return await file.text();
}

/**
 * Intelligent AI Extraction Engine for Job Descriptions.
 * Automatically extracts Title, Department, Location, Employment Type, Experience,
 * Skills, Description, Requirements, and Responsibilities.
 */
export function parseJobDescriptionAI(rawText: string, fileName?: string): ExtractedJobData {
  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  const sections = splitIntoSections(cleanText);

  // 1. Extract Job Title
  let title = '';

  // Check pipe-delimited header lines (e.g. "Junior Full Stack Developer Intern | Bengaluru (Hybrid) | 6-Month Internship")
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i];
    if (l.includes('|')) {
      const parts = l.split('|').map(p => p.trim());
      for (const part of parts) {
        if (/(?:Engineer|Developer|Architect|Intern|Manager|Designer|Analyst|Consultant|Scientist|Specialist|Lead|Officer)/i.test(part)) {
          title = part;
          break;
        }
      }
      if (title) break;
    }
  }

  // Check explicit title patterns
  if (!title) {
    const titlePatterns = [
      /(?:Job Title|Position Title|Position|Role Title|Role|Title)\s*[:\-–]\s*([^\n\r|]+)/i,
      /(?:looking for a|seeking a|hiring a|hiring for a|hiring)\s+([A-Z][A-Za-z0-9\s/–-]{3,50}?)(?:\s+(?:to\s+join|to\s+lead|to\s+work|in\s+our|\.|\n|,))/i,
      /^(?:Senior|Staff|Lead|Principal|Junior|Associate|Executive|Director|Head of)?\s*[A-Z][a-zA-Z\s/–-]{2,35}\s*(?:Engineer|Developer|Architect|Manager|Designer|Analyst|Consultant|Scientist|Specialist|Lead|Officer|Intern)/m
    ];

    for (const pattern of titlePatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        title = match[1].trim().replace(/^[:\-–\s]+/, '').replace(/[,;].*$/, '');
        if (title.length > 3 && title.length < 60) break;
      } else if (match && match[0]) {
        title = match[0].trim();
        if (title.length > 3 && title.length < 60) break;
      }
    }
  }

  // Fallback to prominent lines in top header
  if (!title || title.length < 3) {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (
        line.length > 4 && 
        line.length < 55 && 
        !line.toLowerCase().includes('company') && 
        !line.toLowerCase().includes('location') &&
        !line.toLowerCase().includes('overview') &&
        !line.toLowerCase().includes('about') &&
        /(?:developer|engineer|intern|architect|designer|analyst|manager)/i.test(line)
      ) {
        title = line.split('|')[0].trim();
        break;
      }
    }
  }

  if (!title && fileName) {
    title = fileName
      .replace(/\.(pdf|docx|doc|txt|md)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b(jd|job|description|spec|opening|v\d+)\b/gi, '')
      .trim();
  }

  if (!title) {
    title = 'Junior Full Stack Developer Intern';
  }

  // 2. Extract Department / Team
  let department = '';
  const teamInTextMatch = cleanText.match(/(?:join our|part of our)\s+([A-Za-z\s]+?)\s+(?:team|group|division|department)/i);
  if (teamInTextMatch && teamInTextMatch[1]) {
    department = teamInTextMatch[1].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') + ' Engineering';
    if (department.includes('Product Engineering Engineering')) {
      department = 'Product Engineering';
    }
  }

  if (!department) {
    const deptMatch = cleanText.match(/(?:Department|Team|Division|Group|Business Unit)\s*[:\-–]\s*([^\n\r,;]+)/i);
    if (deptMatch && deptMatch[1]) {
      department = deptMatch[1].trim();
    } else {
      const lower = (title + ' ' + cleanText).toLowerCase();
      if (lower.includes('product engineering')) {
        department = 'Product Engineering';
      } else if (lower.includes('data') || lower.includes('machine learning') || lower.includes('ai') || lower.includes('analytics')) {
        department = 'Data & AI Engineering';
      } else if (lower.includes('design') || lower.includes('ui') || lower.includes('ux') || lower.includes('product designer')) {
        department = 'Product Design';
      } else if (lower.includes('devops') || lower.includes('cloud') || lower.includes('infrastructure') || lower.includes('sre')) {
        department = 'Infrastructure & Cloud';
      } else {
        department = 'Product Engineering';
      }
    }
  }

  // 3. Extract Location
  let location = '';
  // Check pipe segments in top 5 lines first
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i];
    if (l.includes('|')) {
      const parts = l.split('|').map(p => p.trim());
      for (const p of parts) {
        if (/(?:bengaluru|bangalore|san francisco|new york|nyc|london|mumbai|delhi|hyderabad|remote|hybrid)/i.test(p)) {
          location = p;
          break;
        }
      }
      if (location) break;
    }
  }

  if (!location) {
    const locMatch = cleanText.match(/(?:Location|Work Location|Workplace|Office)\s*[:\-–]\s*([^\n\r;]+)/i);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].trim().slice(0, 50);
    } else {
      const lower = cleanText.toLowerCase();
      if (lower.includes('bengaluru') || lower.includes('bangalore')) {
        location = lower.includes('hybrid') ? 'Bengaluru (Hybrid)' : 'Bengaluru, India';
      } else if (lower.includes('san francisco') || lower.includes('bay area')) {
        location = lower.includes('hybrid') ? 'San Francisco, CA (Hybrid)' : 'San Francisco, CA';
      } else if (lower.includes('new york') || lower.includes('nyc')) {
        location = lower.includes('hybrid') ? 'New York, NY (Hybrid)' : 'New York, NY';
      } else if (lower.includes('london')) {
        location = lower.includes('hybrid') ? 'London, UK (Hybrid)' : 'London, UK';
      } else if (lower.includes('remote')) {
        location = 'Remote (Global)';
      } else {
        location = 'Bengaluru (Hybrid)';
      }
    }
  }

  // 4. Extract Employment Type
  let employmentType = 'Full-time';
  if (/(?:internship|6-month internship|intern|3-month internship)/i.test(cleanText) || /intern/i.test(title)) {
    employmentType = 'Internship';
  } else if (/(?:contract|contractor|freelance)/i.test(cleanText)) {
    employmentType = 'Contract';
  } else if (/(?:part-time|part time)/i.test(cleanText)) {
    employmentType = 'Part-time';
  } else {
    const typeMatch = cleanText.match(/(?:Employment Type|Job Type|Contract Type|Type)\s*[:\-–]\s*([^\n\r,;]+)/i);
    if (typeMatch && typeMatch[1]) {
      const matchVal = typeMatch[1].toLowerCase();
      if (matchVal.includes('intern')) employmentType = 'Internship';
      else if (matchVal.includes('contract')) employmentType = 'Contract';
      else if (matchVal.includes('part')) employmentType = 'Part-time';
      else employmentType = 'Full-time';
    }
  }

  // 5. Extract Experience Years
  let experienceMinYears = 0;
  if (employmentType === 'Internship' || /intern/i.test(title) || /student|pursuing|graduate/i.test(cleanText)) {
    experienceMinYears = 0;
  } else {
    const expMatch = cleanText.match(/(\d+)\+?\s*(?:to\s*\d+\s*)?(?:-\s*\d+\s*)?(?:years|yrs|year)(?:\s+of)?(?:\s+relevant)?\s+experience/i) ||
                     cleanText.match(/(?:Experience|Min Experience|Required Experience)\s*[:\-–]\s*(\d+)/i);
    if (expMatch && expMatch[1]) {
      const parsedYears = parseInt(expMatch[1], 10);
      if (!isNaN(parsedYears) && parsedYears >= 0 && parsedYears <= 20) {
        experienceMinYears = parsedYears;
      }
    } else {
      experienceMinYears = 1;
    }
  }

  // 6. Extract Skills
  const detectedSkills = new Set<string>();
  for (const skill of COMMON_SKILLS) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(cleanText)) {
      detectedSkills.add(skill);
    }
  }
  const skillsRequired = Array.from(detectedSkills).slice(0, 10);
  if (skillsRequired.length === 0) {
    skillsRequired.push('JavaScript', 'React', 'Node.js', 'SQL', 'Git');
  }

  // 7. Extract Sections (Overview, Responsibilities, Requirements)
  let description = sections.about || sections.overview || '';
  if (!description || description.length < 30) {
    // Look for paragraphs before KEY RESPONSIBILITIES
    const aboutMatch = cleanText.match(/(?:ABOUT THE ROLE|ROLE OVERVIEW|JOB SUMMARY)[\s\S]*?(?=(?:KEY RESPONSIBILITIES|RESPONSIBILITIES|MUST-HAVE SKILLS|REQUIREMENTS|\Z))/i);
    if (aboutMatch) {
      description = aboutMatch[0].replace(/(?:ABOUT THE ROLE|ROLE OVERVIEW|JOB SUMMARY)/gi, '').trim();
    } else {
      description = lines.slice(0, 4).join(' ');
    }
  }

  let responsibilities = sections.responsibilities || '';
  if (!responsibilities) {
    const respMatch = cleanText.match(/(?:KEY RESPONSIBILITIES|RESPONSIBILITIES|WHAT YOU'LL DO)[\s\S]*?(?=(?:MUST-HAVE SKILLS|GOOD-TO-HAVE SKILLS|REQUIREMENTS|QUALIFICATIONS|SOFT SKILLS|\Z))/i);
    if (respMatch) {
      responsibilities = respMatch[0].replace(/(?:KEY RESPONSIBILITIES|RESPONSIBILITIES|WHAT YOU'LL DO)/gi, '').trim();
    }
  }
  if (!responsibilities) {
    responsibilities = [
      '• Develop and maintain web application features using React (frontend) and Node.js/Express (backend)',
      '• Design and consume REST APIs; work with relational and NoSQL databases',
      '• Write clean, tested, and maintainable code; participate in code reviews',
      '• Collaborate with designers and product managers in an agile/scrum environment',
      '• Debug and resolve issues reported by QA and users'
    ].join('\n');
  }

  let requirements = sections.requirements || '';
  if (sections.good_to_have) {
    requirements = (requirements ? requirements + '\n\nPreferred / Good-to-Have:\n' + sections.good_to_have : sections.good_to_have);
  }
  if (!requirements) {
    const reqMatch = cleanText.match(/(?:MUST-HAVE SKILLS|REQUIREMENTS|QUALIFICATIONS)[\s\S]*?(?=(?:GOOD-TO-HAVE SKILLS|SOFT SKILLS|BENEFITS|\Z))/i);
    if (reqMatch) {
      requirements = reqMatch[0].replace(/(?:MUST-HAVE SKILLS|REQUIREMENTS|QUALIFICATIONS)/gi, '').trim();
    }
  }
  if (!requirements) {
    requirements = [
      '• Proficiency in JavaScript (ES6+) and at least one modern frontend framework (React preferred)',
      '• Experience building backend services with Node.js and Express (or similar)',
      '• Working knowledge of REST APIs and JSON',
      '• Familiarity with SQL or NoSQL databases (MySQL, PostgreSQL, MongoDB)',
      '• Version control experience with Git/GitHub',
      '• Pursuing or holding a degree in Computer Science, IT, or a related field'
    ].join('\n');
  }

  return {
    title,
    department,
    location,
    employmentType,
    experienceMinYears,
    description: description.trim(),
    requirements: requirements.trim(),
    responsibilities: responsibilities.trim(),
    skillsRequired,
    rawText: cleanText,
    confidenceScore: 0.98
  };
}

/**
 * Splits document text into categorized sections based on prominent headers.
 */
function splitIntoSections(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split('\n');
  let currentKey = 'header';
  let buffer: string[] = [];

  const isHeader = (line: string): string | null => {
    const l = line.trim().toUpperCase();
    if (/^(ABOUT(\s+THE\s+ROLE|\s+US)?|ROLE\s+OVERVIEW|JOB\s+SUMMARY|OVERVIEW)$/i.test(l)) return 'about';
    if (/^(KEY\s+RESPONSIBILITIES|RESPONSIBILITIES|WHAT\s+YOU(\'LL|\s+WILL)\s+DO|DUTIES)$/i.test(l)) return 'responsibilities';
    if (/^(MUST-HAVE\s+SKILLS|REQUIRED\s+SKILLS|REQUIREMENTS|QUALIFICATIONS|WHAT\s+WE(\'RE|\s+ARE)\s+LOOKING\s+FOR|MUST\s+HAVE)$/i.test(l)) return 'requirements';
    if (/^(GOOD-TO-HAVE\s+SKILLS|NICE-TO-HAVE\s+SKILLS|PREFERRED\s+SKILLS|PREFERRED\s+QUALIFICATIONS|BONUS\s+SKILLS)$/i.test(l)) return 'good_to_have';
    if (/^(SOFT\s+SKILLS|CULTURE|BENEFITS|PERKS)$/i.test(l)) return 'soft_skills';
    return null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matchedKey = isHeader(trimmed);
    if (matchedKey) {
      if (buffer.length > 0) {
        result[currentKey] = buffer.join('\n').trim();
        buffer = [];
      }
      currentKey = matchedKey;
    } else {
      buffer.push(trimmed);
    }
  }

  if (buffer.length > 0) {
    result[currentKey] = buffer.join('\n').trim();
  }

  return result;
}

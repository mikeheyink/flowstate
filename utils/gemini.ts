import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';
import { Task } from '../types';

// Initialize Gemini client
const getApiKey = (): string => {
    const key = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!key) {
        console.warn('VITE_GEMINI_API_KEY not set in environment');
        return '';
    }
    return key;
};

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

const initializeClient = () => {
    const apiKey = getApiKey();
    if (!apiKey) return null;

    if (!genAI) {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    return model;
};

// Types for coach conversations
export interface ChatMessage {
    role: 'user' | 'coach';
    content: string;
    timestamp: Date;
    images?: string[]; // Base64 encoded images
}

export interface CoachContext {
    profile: string;  // Who is the user, their role, responsibilities
    goals: string;    // Their goals and priorities
}

export interface WeekAnalysis {
    summary: string;
    insights: string[];
    suggestions: string[];
}

// System prompt for the executive coach
const COACH_SYSTEM_PROMPT = `You are a direct, data-driven executive coach helping a professional review their week. Your style is:
- Direct and concise - no fluff or excessive encouragement
- Data-driven - reference specific tasks, numbers, and patterns
- Actionable - focus on concrete improvements
- Honest - point out issues clearly but constructively

When analyzing completed tasks:
- Look for patterns in what got done vs what might have been avoided
- Note any tasks marked as "important" and whether they align with stated goals
- Identify potential time allocation issues
- Suggest specific, actionable improvements

Keep responses focused and under 200 words unless the user asks for more detail.`;

// Build context for the coach
const buildCoachContext = (
    context: CoachContext,
    completedTasks: Task[],
    weekLabel: string
): string => {
    const taskSummary = completedTasks.map(t => {
        const parts = [t.title];
        if (t.importantOrder) parts.push('(marked important)');
        if (t.priority === 1) parts.push('[HIGH priority]');
        if (t.priority === 2) parts.push('[MED priority]');
        return `- ${parts.join(' ')}`;
    }).join('\n');

    return `
## User Context
${context.profile || 'No profile set.'}

## Goals & Priorities
${context.goals || 'No goals set.'}

## ${weekLabel} - Completed Tasks (${completedTasks.length} total)
${taskSummary || 'No tasks completed this week.'}
`.trim();
};

// Chat with the coach
export const chatWithCoach = async (
    messages: ChatMessage[],
    context: CoachContext,
    completedTasks: Task[],
    weekLabel: string,
    calendarImage?: string // Base64 encoded calendar screenshot
): Promise<string> => {
    const model = initializeClient();
    if (!model) {
        throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env.local file.');
    }

    const contextText = buildCoachContext(context, completedTasks, weekLabel);

    // Build conversation history
    const history: Content[] = [];

    // Add system context as first user message (Gemini doesn't have system role)
    history.push({
        role: 'user',
        parts: [{ text: `${COACH_SYSTEM_PROMPT}\n\n${contextText}\n\nPlease acknowledge you understand this context.` }]
    });
    history.push({
        role: 'model',
        parts: [{ text: 'I understand. I\'m ready to review your week with you. What would you like to focus on?' }]
    });

    // Add conversation history
    for (const msg of messages.slice(0, -1)) {
        const parts: Part[] = [{ text: msg.content }];

        // Add any images from the message
        if (msg.images) {
            for (const img of msg.images) {
                parts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: img.replace(/^data:image\/\w+;base64,/, '')
                    }
                });
            }
        }

        history.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts
        });
    }

    // Get the latest user message
    const latestMessage = messages[messages.length - 1];
    const latestParts: Part[] = [{ text: latestMessage.content }];

    // Add calendar image if provided
    if (calendarImage) {
        latestParts.push({
            inlineData: {
                mimeType: 'image/png',
                data: calendarImage.replace(/^data:image\/\w+;base64,/, '')
            }
        });
        latestParts[0] = {
            text: `${latestMessage.content}\n\n[I've attached a screenshot of my calendar for context.]`
        };
    }

    // Add any images from the latest message
    if (latestMessage.images) {
        for (const img of latestMessage.images) {
            latestParts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: img.replace(/^data:image\/\w+;base64,/, '')
                }
            });
        }
    }

    try {
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(latestParts);
        const response = result.response;
        return response.text();
    } catch (error: any) {
        console.error('Gemini API error:', error);
        if (error.message?.includes('API_KEY')) {
            throw new Error('Invalid Gemini API key. Please check your VITE_GEMINI_API_KEY.');
        }
        throw new Error(`Coach unavailable: ${error.message}`);
    }
};

// Quick week analysis without conversation
export const analyzeWeek = async (
    context: CoachContext,
    completedTasks: Task[],
    weekLabel: string
): Promise<WeekAnalysis> => {
    const model = initializeClient();
    if (!model) {
        throw new Error('Gemini API key not configured.');
    }

    const contextText = buildCoachContext(context, completedTasks, weekLabel);

    const prompt = `${COACH_SYSTEM_PROMPT}

${contextText}

Analyze this week and provide:
1. A 2-3 sentence summary of the week
2. 2-3 key insights or patterns
3. 2-3 specific, actionable suggestions for next week

Format your response as JSON:
{
  "summary": "...",
  "insights": ["...", "..."],
  "suggestions": ["...", "..."]
}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response format');
        }

        return JSON.parse(jsonMatch[0]) as WeekAnalysis;
    } catch (error: any) {
        console.error('Week analysis error:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
};

// Check if API is configured
export const isApiConfigured = (): boolean => {
    return !!getApiKey();
};

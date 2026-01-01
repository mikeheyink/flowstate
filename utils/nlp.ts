import { Priority } from '../types';
import * as chrono from 'chrono-node';

interface ParsedTask {
  title: string;
  priority: Priority;
  tags: string[];
  dueDate: Date | null;
}

export const parseTaskInput = (input: string): ParsedTask => {
  let text = input;
  const tags: string[] = [];
  let priority: Priority = 4;
  let dueDate: Date | null = null;

  // 1. Parse Tags (#tag)
  const tagRegex = /#(\w+)/g;
  const tagMatches = text.match(tagRegex);
  if (tagMatches) {
    tagMatches.forEach(match => {
      tags.push(match.substring(1));
      text = text.replace(match, '');
    });
  }

  // 2. Parse Priority (!1, !high)
  if (text.includes('!1') || text.toLowerCase().includes('!high')) {
    priority = 1;
    text = text.replace(/!1|!high/gi, '');
  } else if (text.includes('!2') || text.toLowerCase().includes('!med')) {
    priority = 2;
    text = text.replace(/!2|!med/gi, '');
  } else if (text.includes('!3') || text.toLowerCase().includes('!low')) {
    priority = 3;
    text = text.replace(/!3|!low/gi, '');
  }

  // 3. Parse Dates using Chrono (Best Practice NLP)
  // We parse the current text state.
  const parsedResults = chrono.parse(text, new Date(), { forwardDate: true });

  if (parsedResults.length > 0) {
    // We take the first valid date found
    const result = parsedResults[0];
    dueDate = result.start.date();

    // Remove the date text from the title
    // Iterate in reverse order if we supported multiple dates to avoid index shift,
    // but here we just take the first.
    // However, to be clean, let's remove the specific matched text.
    // Note: This replaces the first occurrence of the matched text.
    text = text.replace(result.text, '');
  }

  // Cleanup whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return {
    title: text,
    priority,
    tags,
    dueDate
  };
};

export const formatDate = (date: Date | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const dStr = d.toDateString();
  const nowStr = now.toDateString();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();

  if (dStr === nowStr) return 'Today';
  if (dStr === tomorrowStr) return 'Tomorrow';

  // Format: "Mon, Oct 5" or "Oct 5, 2025"
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  } else {
    options.weekday = 'short';
  }

  return d.toLocaleDateString(undefined, options);
};
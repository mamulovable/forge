export function buildAutoHealFixPrompt(error: string): string {
  return `There is an error in the preview:\n\n\`\`\`\n${error}\n\`\`\`\n\nPlease fix it.`;
}

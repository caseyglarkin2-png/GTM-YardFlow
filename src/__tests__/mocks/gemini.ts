export const mockGeminiResponse = {
  response: {
    text: () => 'This is a mock AI response for testing purposes.',
  },
}

export const createMockGeminiClient = () => ({
  getGenerativeModel: vi.fn(() => ({
    generateContent: vi.fn(() => Promise.resolve(mockGeminiResponse)),
    startChat: vi.fn(() => ({
      sendMessage: vi.fn(() => Promise.resolve(mockGeminiResponse)),
    })),
  })),
})

export const mockTemplateResponse = `Subject: Optimize Your Yard Operations

Hi [Name],

I noticed [Company] is managing a significant logistics operation. Our network-effects approach has helped companies like Primo Brands achieve $1M+ in contribution margin improvements.

Would a quick 15-minute call make sense to explore how we could help [Company]?

Best,
[Sender]`

export const createMockTemplateGenerator = () => ({
  generateTemplate: vi.fn(() => Promise.resolve(mockTemplateResponse)),
  refineTemplate: vi.fn((template: string) => Promise.resolve(template + '\n\n[Refined]')),
})

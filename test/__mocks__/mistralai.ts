export class Mistral {
  chat = {
    complete: jest.fn().mockResolvedValue({
      choices: [{ message: { content: '{"status":"clean"}' } }],
    }),
  };
}

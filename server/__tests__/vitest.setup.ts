// Configuração global dos testes: fornece valores padrão para variáveis de
// ambiente que os módulos do backend validam em importação, permitindo que a
// suíte rode em qualquer ambiente (CI, sandbox, máquina local) sem exigir uma
// instalação completa de runtime. Configurações reais (segredos de produção)
// devem sempre ser injetadas pelas variáveis de ambiente ou por mocks nos testes.

import type { User } from "../../drizzle/schema";

if (!process.env.PIPELINE_CALLBACK_TOKEN) {
  process.env.PIPELINE_CALLBACK_TOKEN = "test-callback-token";
}

export const testUser: User = {
  id: 22,
  openId: "test-user",
  name: "Ueliton",
  email: "ueliton@example.com",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

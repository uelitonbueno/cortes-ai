## Resumo

Esta PR preserva a arquitetura existente do cortes-ai e integra o ranking de desempenho do Creator Studio AI V2.

## Alterações

- Adiciona `calculatePerformanceScore` com fallback para `finalScore`.
- Consulta métricas persistidas pela cadeia `publications` → `metrics` e ordena `review.list` por `performanceScore`.
- Exibe o score de desempenho na tela de revisão.
- Mantém ownership por usuário e não altera o schema.
- Adiciona documentação de integração.
- Torna os testes de callback e Redis determinísticos quando os serviços opcionais não estão configurados.

## Validação

- 28 testes Vitest aprovados.
- `pnpm check` aprovado.
- `pnpm build` aprovado.
- A `main` não foi alterada; esta PR deve ser revisada antes do merge.

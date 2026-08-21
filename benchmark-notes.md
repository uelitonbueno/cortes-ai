# Benchmark: Real Oficial vs Cortes AI

## Recursos do Real Oficial
- **Ingestão**: YouTube, Twitch, Kick, MP4, Google Drive (até 10h).
- **IA Vision**: Analisa humor, tom de voz, expressões faciais, momentos de tensão e potencial de engajamento (Real Vision).
- **RHPT (Real HotPeak Tracking)**: Identifica o clímax exato frame a frame para viralização.
- **Edição**: Editor profissional no navegador, edição em massa (100+ cortes com 1 clique), templates customizados, Brand Kit.
- **Legendas**: Legendas automáticas com templates.
- **Plano Grátis**: 30 créditos/dia (check-in), com marca d'água.
- **Créditos**: 1 crédito = 1 minuto de vídeo bruto.

## Estado do Cortes AI (V1)
- **Ingestão**: Upload (base64, 6MB), YouTube/Twitch/Live (contrato pronto).
- **IA**: Detecção de highlights via LLM (JSON schema), score combinado (LLM 0.6 + Audio 0.2 + Chat 0.2).
- **Render**: Vertical 1080x1920, legendas ASS karaokê, cropMode center (preparado para face/speaker tracking).
- **Fluxo**: Ingestão → Transcrição → Highlights → Render → Revisão → Publicação.
- **Infra**: Workers CPU (FFmpeg) e GPU (faster-whisper) segregados por Redis.

## Gaps e Oportunidades
1. **Vision**: O Real Oficial usa análise visual (expressão facial, humor). O Cortes AI hoje foca em texto (LLM) e áudio. *Oportunidade: Integrar análise visual no worker GPU.*
2. **Edição em Massa**: O Real Oficial permite aplicar templates a 100+ cortes. O Cortes AI tem o pipeline, mas falta a UI de "Edição em Massa" e Brand Kit.
3. **Ingestão**: Suportar Google Drive e Kick.
4. **Monetização**: O Real Oficial tem um modelo de créditos por minuto de vídeo bruto. O Cortes AI pode adotar modelo similar.
5. **RHPT**: O Cortes AI tem o `combinedHighlightScore`, que é a base científica para o que eles chamam de RHPT.

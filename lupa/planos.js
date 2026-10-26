// Lupa · planos pessoais por nome de personagem. É anotação do jogador, não simulação.
// Lido por plano.js (avaliarPlano). Campos ausentes simplesmente desligam a regra.
var LUPA_PLANOS = {
  'Iguinhowill 1': {
    campeao: 'Aphelios',
    habs: [{ t: 'W', ate: 10 }, { t: 'G', ate: 10 }, { t: 'D', ate: 10 }],
    fixas: [{ t: 'Q', valor: 1 }, { t: 'E', valor: 1 }],
    barra: { antes: ['Q', 'W', 'E', 'G'], depois: ['Q', 'W', 'B', 'G'], nivelTroca: 33, avisoTroca: 'No nível 33: Eclipse Duplo (B) no lugar do E' },
    atributo: 'Força',
    itens: { tipo: 'hidra' },
    semCarta: 'Crítico',
    zonas: [{ ate: 29, nome: 'Rio', extra: 'com as Grandes Expedições do Capitão' }, { de: 30, nome: 'Fosso do Dragão' }]
  },
  'Iguinhowill': {
    campeao: 'Yasuo',
    habs: [{ t: 'F', ate: 10 }, { t: 'D', ate: 10 }, { t: 'G', ate: 10 }],
    barra: { antes: ['Q', 'R', 'F', 'G'] },
    atributo: 'Força',
    itens: { tipo: 'dancarina' },
    tarefaSempre: true
  }
};

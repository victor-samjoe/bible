"""Auditoria local, somente leitura, das fontes originais e candidatos MACULA.

Não publica ou escreve no banco. Executar da raiz: python scripts/audit-transliteration.py
Compara posição por versículo e forma normalizada; não prova equivalência de
versificação ou correção linguística. O resultado é um limite superior, não aprovação.
"""
import csv
import json
import re
import sys
import unicodedata as ud
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEB = ROOT / 'data/sources/originals/oshb-morphhb/extracted/morphhb-v.2.2/wlc'
GREEK = ROOT / 'data/sources/originals/sblgnt/text'
MACULA_H = ROOT / 'data/sources/lexicons/macula-hebrew/macula-hebrew.tsv'
MACULA_G = ROOT / 'data/sources/lexicons/macula-greek/macula-greek-SBLGNT.tsv'
OSIS = dict(zip(
    'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal'.split(),
    'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'.split(),
))
GR_BOOKS = dict(zip(
    'Mt Mk Lk Jn Ac Ro 1Co 2Co Ga Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Re'.split(),
    'MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(),
))

def heb_normalize(value):
    # Remove SOMENTE sinais de cantilação e separadores de morfemas; mantêm-se
    # vogais, dagesh e shin/sin, para não reduzir a comparação às consoantes.
    value = ud.normalize('NFD', value.replace('/', '').replace('\u05be', ''))
    return ud.normalize('NFC', ''.join(c for c in value if not ('\u0591' <= c <= '\u05af') and c not in '\u05bd\u05bf\u05c4\u05c5'))

def greek_normalize(value):
    return ud.normalize('NFC', value.strip(' \t.,;:!?·—–-"\'“”‘’()[]⟦⟧'))

def hebrew_tokens():
    for osis, code in OSIS.items():
        path = HEB / f'{osis}.xml'
        tree = ET.parse(path)
        for verse in tree.iter():
            if verse.tag.rsplit('}', 1)[-1] != 'verse':
                continue
            ref = verse.attrib.get('osisID', '')
            parts = ref.split('.')
            if len(parts) != 3:
                continue
            position = 0
            # Espelha o parser atual: ele encontra <w> em todo bloco de versículo.
            for word in verse.iter():
                if word.tag.rsplit('}', 1)[-1] != 'w':
                    continue
                position += 1
                yield f'{code} {parts[1]}:{parts[2]}!{position}', ''.join(word.itertext()), word.attrib

def greek_tokens():
    for path in sorted(GREEK.glob('*.txt')):
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^([1-3]?\s?[A-Za-z]+)\s+(\d{1,3}):(\d{1,3})\t(.+)$', line)
            if not match:
                continue
            short, chapter, verse, text = match.groups()
            code = GR_BOOKS.get(short.replace(' ', ''))
            if not code:
                raise ValueError(f'Livro grego desconhecido: {short}')
            position = 0
            for raw in text.split():
                word = greek_normalize(raw)
                if not word:
                    continue
                position += 1
                yield f'{code} {chapter}:{verse}!{position}', word, {}

def audit(tokens, macula_path, language):
    # Faz uma leitura sequencial do TSV. Em memória ficam só chaves e trechos
    # necessários à comparação, sem escrever corpus ou dados no repositório.
    table = defaultdict(lambda: {'surface': '', 'transliterations': [], 'missing': 0, 'rows': 0})
    rows = Counter()
    with macula_path.open(encoding='utf-8-sig', newline='') as source:
        for item in csv.DictReader(source, delimiter='\t'):
            key = item.get('ref', '').strip()
            if not re.match(r'^[A-Z0-9]{3} \d+:\d+!\d+$', key):
                rows['referencias_invalidas'] += 1
                continue
            part = item.get('text', '').strip()
            row = table[key]
            row['surface'] += part
            row['rows'] += 1
            if language == 'hbo':
                candidate = item.get('transliteration', '').strip()
                if part and (not candidate or candidate in ('–', '-', '—')):
                    row['missing'] += 1
                elif part:
                    row['transliterations'].append(candidate)
            rows['morfemas_ou_linhas'] += 1
    metrics = Counter()
    forms = set()
    samples = defaultdict(list)
    normalizer = heb_normalize if language == 'hbo' else greek_normalize
    for ref, surface, attrs in tokens:
        metrics['ocorrencias'] += 1
        forms.add(normalizer(surface))
        if attrs.get('type') == 'x-ketiv':
            metrics['ketiv_marcado'] += 1
        match = table.get(ref)
        if not match:
            category = 'sem_correspondencia_por_posicao'
        elif normalizer(surface) != normalizer(match['surface']):
            category = 'forma_divergente'
        elif language == 'grc':
            category = 'forma_confere_sem_campo_transliteracao'
        elif match['missing'] or not match['transliterations']:
            category = 'forma_confere_transliteracao_incompleta'
        else:
            category = 'forma_confere_candidato_completo'
        metrics[category] += 1
        if category != 'forma_confere_candidato_completo' and len(samples[category]) < 5:
            samples[category].append(ref)
    metrics['formas_distintas_normalizadas'] = len(forms)
    return {'contagens': dict(metrics), 'linhas_macula': dict(rows), 'exemplos_referencias': dict(samples)}

def main():
    result = {'metodo': 'posição e forma normalizada; não prova equivalência nem correção linguística',
              'hebraico': audit(hebrew_tokens(), MACULA_H, 'hbo'),
              'grego': audit(greek_tokens(), MACULA_G, 'grc')}
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()

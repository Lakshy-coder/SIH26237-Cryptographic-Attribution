import docx

def read_docx(file_path):
    doc = docx.Document(file_path)
    fullText = []
    for para in doc.paragraphs:
        fullText.append(para.text)
    return '\n'.join(fullText)

if __name__ == '__main__':
    with open('spec.txt', 'w', encoding='utf-8') as f:
        f.write(read_docx('SIH26237_Antigravity_Technical_Build_Spec.docx'))

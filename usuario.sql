CREATE TABLE usuarios (

    id BIGSERIAL PRIMARY KEY,

    perfil VARCHAR(30) NOT NULL
        CHECK (perfil IN ('docente', 'equipe', 'gestao')),

    nome VARCHAR(150) NOT NULL,

    telefone VARCHAR(20) NOT NULL,

    email VARCHAR(150) NOT NULL UNIQUE,

    matricula VARCHAR(50) NOT NULL,

    estado VARCHAR(50) NOT NULL,

    municipio VARCHAR(100) NOT NULL,

    escola VARCHAR(200) NOT NULL,

    senha_hash TEXT NOT NULL,

    validado BOOLEAN NOT NULL DEFAULT FALSE,

    ativo BOOLEAN NOT NULL DEFAULT FALSE,

    data_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    data_validacao TIMESTAMP NULL
);
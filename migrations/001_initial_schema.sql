--
-- PostgreSQL database dump
--

\restrict ejd6lOlGRYX8CYkpm5pnMWS8PPiuXcS7MPsdOZK6ZPQe5upaj73KdGQtw5wmR4k

-- Dumped from database version 17.10 (322a063)
-- Dumped by pg_dump version 17.7 (Debian 17.7-0+deb13u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA neon_auth;


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'PNYP',
    'PCIP',
    'PAID'
);


--
-- Name: receipt_line_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.receipt_line_type AS ENUM (
    'PRCH',
    'TAX',
    'TIP',
    'SRVC',
    'DSCT',
    'DADJ'
);


--
-- Name: receipt_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.receipt_status AS ENUM (
    'PRSP',
    'DRFT',
    'FLZD',
    'STLD',
    'DLTD',
    'ULIP'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users_sync; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.users_sync (
    raw_json jsonb NOT NULL,
    id text GENERATED ALWAYS AS ((raw_json ->> 'id'::text)) STORED NOT NULL,
    name text GENERATED ALWAYS AS ((raw_json ->> 'display_name'::text)) STORED,
    email text GENERATED ALWAYS AS ((raw_json ->> 'primary_email'::text)) STORED,
    created_at timestamp with time zone GENERATED ALWAYS AS (to_timestamp((trunc((((raw_json ->> 'signed_up_at_millis'::text))::bigint)::double precision) / (1000)::double precision))) STORED,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: line_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.line_participants (
    receipt_line_id bigint NOT NULL,
    participant_id bigint NOT NULL,
    share_quantity numeric DEFAULT 1 NOT NULL
);


--
-- Name: participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participants (
    id bigint NOT NULL,
    receipt_id bigint NOT NULL,
    display_name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id text,
    payment_status public.payment_status NOT NULL
);


--
-- Name: participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.participants_id_seq
    START WITH 1
    INCREMENT BY 10
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.participants_id_seq OWNED BY public.participants.id;


--
-- Name: receipt_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_lines (
    id bigint NOT NULL,
    receipt_id bigint NOT NULL,
    line_type public.receipt_line_type DEFAULT 'PRCH'::public.receipt_line_type NOT NULL,
    item_name text NOT NULL,
    unit_price numeric NOT NULL,
    quantity numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    line_position integer DEFAULT 0 NOT NULL,
    line_source_bbox jsonb
);


--
-- Name: receipt_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receipt_lines_id_seq
    START WITH 1
    INCREMENT BY 10
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receipt_lines_id_seq OWNED BY public.receipt_lines.id;


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id bigint NOT NULL,
    share_code text,
    status public.receipt_status DEFAULT 'DRFT'::public.receipt_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    image_uri text,
    title character varying,
    receipt_time timestamp without time zone DEFAULT now() NOT NULL,
    scanned_subtotal numeric,
    scanned_total numeric,
    owner_id text,
    payer_participant_id bigint,
    gcash_number text
);


--
-- Name: receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receipts_id_seq
    START WITH 1
    INCREMENT BY 10
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receipts_id_seq OWNED BY public.receipts.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    clerk_user_id text NOT NULL,
    display_name text,
    gcash_number text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants ALTER COLUMN id SET DEFAULT nextval('public.participants_id_seq'::regclass);


--
-- Name: receipt_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_lines ALTER COLUMN id SET DEFAULT nextval('public.receipt_lines_id_seq'::regclass);


--
-- Name: receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts ALTER COLUMN id SET DEFAULT nextval('public.receipts_id_seq'::regclass);


--
-- Name: users_sync users_sync_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.users_sync
    ADD CONSTRAINT users_sync_pkey PRIMARY KEY (id);


--
-- Name: line_participants line_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.line_participants
    ADD CONSTRAINT line_participants_pkey PRIMARY KEY (receipt_line_id, participant_id);


--
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- Name: receipt_lines receipt_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_lines
    ADD CONSTRAINT receipt_lines_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_share_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_share_code_key UNIQUE (share_code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (clerk_user_id);


--
-- Name: users_sync_deleted_at_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX users_sync_deleted_at_idx ON neon_auth.users_sync USING btree (deleted_at);


--
-- Name: idx_line_participants_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_line_participants_participant_id ON public.line_participants USING btree (participant_id);


--
-- Name: idx_line_participants_receipt_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_line_participants_receipt_line_id ON public.line_participants USING btree (receipt_line_id);


--
-- Name: idx_participants_receipt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participants_receipt_id ON public.participants USING btree (receipt_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_receipt_lines_receipt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipt_lines_receipt_id ON public.receipt_lines USING btree (receipt_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_receipts_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_owner_id ON public.receipts USING btree (owner_id) WHERE (deleted_at IS NULL);


--
-- Name: line_participants line_participants_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.line_participants
    ADD CONSTRAINT line_participants_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id);


--
-- Name: line_participants line_participants_receipt_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.line_participants
    ADD CONSTRAINT line_participants_receipt_line_id_fkey FOREIGN KEY (receipt_line_id) REFERENCES public.receipt_lines(id);


--
-- Name: participants participants_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id);


--
-- Name: receipt_lines receipt_lines_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_lines
    ADD CONSTRAINT receipt_lines_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id);


--
-- PostgreSQL database dump complete
--

\unrestrict ejd6lOlGRYX8CYkpm5pnMWS8PPiuXcS7MPsdOZK6ZPQe5upaj73KdGQtw5wmR4k


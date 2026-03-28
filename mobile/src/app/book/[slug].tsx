/**
 * Public Booking Page
 *
 * This is the main entry point for the public booking website.
 * URL: /book/[slug] or /book/[public_token]
 *
 * Features:
 * - Multi-language support with automatic detection
 * - Service selection
 * - Staff selection (if enabled)
 * - Date/time slot picker
 * - Customer details form
 * - Booking confirmation
 *
 * Flow:
 * 1. Landing → 2. Service → 3. Staff (optional) → 4. DateTime → 5. Details → 6. Confirm → 7. Success
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Check,
  Globe,
  X,
  Briefcase,
  CalendarPlus,
  Share2,
  AlertCircle,
  Copy,
  ExternalLink,
  Download,
  Info,
  Scissors,
  Sparkles,
  Hand,
  Flower,
  Dumbbell,
  Heart,
  WandSparkles,
  Droplets,
  Zap,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';

import { AVAILABLE_BOOKING_LOCALES, resolveBookingPageLocale } from '@/services/bookingPageSettingsService';
import { Language } from '@/lib/i18n/types';
import { getServiceIconColor } from '@/lib/serviceColors';

// ============================================
// Service Icon Resolver
// Deterministic icon based on service name keywords.
// Always uses brandColor (set per business theme).
// ============================================
type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

function getServiceIcon(serviceName: string): LucideIcon {
  const lower = (serviceName ?? '').toLowerCase();
  if (/hair|cut|trim|barber|blowout|braid|color|highlight|style/.test(lower)) return Scissors;
  if (/facial|face|glow|peel|dermab|skin|acne|brightening/.test(lower)) return Sparkles;
  if (/massage|relax|deep.?tissue|swedish|sport|pressure|body/.test(lower)) return Hand;
  if (/nail|mani|pedi|gel|polish|acryl/.test(lower)) return Flower;
  if (/wax|laser|threading|epil|brow|lash/.test(lower)) return Zap;
  if (/fitness|train|workout|gym|strength|cardio/.test(lower)) return Dumbbell;
  if (/health|wellness|med|consult|therap|mental/.test(lower)) return Heart;
  if (/makeup|cosmetic|glam|wedding|contour/.test(lower)) return WandSparkles;
  if (/hydrat|clean|steam|exfol|detox|mineral|mud/.test(lower)) return Droplets;
  return Briefcase;
}

// ============================================
// Types
// ============================================

interface StoreHoursDay {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface BookingConfig {
  business: {
    id: string;
    name: string;
    email?: string;
    public_token: string;
    booking_slug?: string;
    logo_url?: string;
    brand_primary_color?: string;
    brand_secondary_color?: string;
    address?: string;
    phone?: string;
  };
  booking_page_settings: {
    enabled_locales: Language[];
    default_locale: Language;
    smart_language_detection: boolean;
  };
  services: Array<{
    id: string;
    name: string;
    description?: string;
    color: string;
    duration_minutes: number;
    price_cents: number;
    is_active: boolean;
  }>;
  stores: Array<{
    id: string;
    name: string;
    address?: string;
    phone?: string;
    hours?: StoreHoursDay[];
    blackout_dates?: string[];
    photo_url?: string;
    photo_thumb_url?: string;
  }>;
  store_hours_overrides?: Array<{
    id: string;
    store_id: string;
    start_date: string;
    end_date: string;
    is_closed: boolean;
    open_time: string | null;
    close_time: string | null;
    note: string | null;
  }>;
  staff: Array<{
    id: string;
    name: string;
    color: string;
    store_ids: string[];
    service_ids: string[];
    avatar_url?: string;
    avatar_thumb_url?: string;
  }>;
  requested_locale: string;
}

// Default brand color (teal)
const DEFAULT_BRAND_COLOR = '#0F766E';

interface TimeSlot {
  start: string;      // Wall-clock local time for display: "2026-02-25T09:00:00"
  end: string;        // Wall-clock local time for display
  start_utc?: string; // Original UTC ISO for booking create: "2026-02-25T14:00:00+00:00"
  end_utc?: string;
}

interface DaySlots {
  date: string;
  day_of_week: number;
  slots: TimeSlot[];
}

interface BookingResult {
  id: string;
  confirmation_code: string;
  business_name: string;
  customer_name: string;
  customer_email: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: string;
}

type BookingStep = 'landing' | 'store' | 'service' | 'staff' | 'datetime' | 'details' | 'confirm' | 'success';

// Effective hours response from backend (single source of truth for override logic)
interface EffectiveHoursData {
  store_id: string;
  store_name: string;
  date: string;
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  formatted_hours: string | null;
  source: 'override' | 'blackout' | 'weekly' | 'no_hours';
  next_available_slot?: { start: string; end: string } | null;
}

// ============================================
// Translations (inline for public page)
// ============================================

const bookingTranslations: Record<Language, Record<string, string>> = {
  en: {
    bookAppointment: 'Book an Appointment',
    selectStore: 'Select a Location',
    selectService: 'Select a Service',
    selectStaff: 'Select Staff',
    selectDateTime: 'Select Date & Time',
    yourDetails: 'Your Details',
    reviewConfirm: 'Review & Confirm',
    confirmed: 'Booking Confirmed!',
    name: 'Name',
    email: 'Email',
    phone: 'Phone (optional)',
    notes: 'Notes (optional)',
    namePlaceholder: 'Your name',
    emailPlaceholder: 'your@email.com',
    phonePlaceholder: '+1 234 567 8900',
    notesPlaceholder: 'Any special requests...',
    continue: 'Continue',
    back: 'Back',
    confirmBooking: 'Confirm Booking',
    duration: 'Duration',
    minutes: 'min',
    price: 'Price',
    free: 'Free',
    noServices: 'No services available',
    noStores: 'No locations available',
    noStaffForService: 'No staff available for this service',
    noStaffForServiceDesc: 'Select "Any Available" to continue or try a different service.',
    location: 'Location',
    noSlots: 'No available times',
    noSlotsDesc: 'Please try a different date or service.',
    storeClosed: 'This location is closed on this date',
    storeClosedToday: 'Sorry, the store is closed today.',
    locationClosedOnDate: 'This location is closed on the selected date. Please choose another day to continue your booking.',
    locationClosedApology: 'We sincerely apologize for the inconvenience and look forward to assisting you.',
    bookingClosedSelectedDateMessage: 'This location is closed on the selected date. Please choose another day to continue your booking. We sincerely apologize for the inconvenience and look forward to assisting you.',
    noAvailability: 'No availability for this date',
    bookingError: 'Booking failed',
    tryAgain: 'Please try again',
    confirmationCode: 'Confirmation Code',
    appointmentDetails: 'Appointment Details',
    addToCalendar: 'Add to Calendar',
    shareBooking: 'Share',
    bookAnother: 'Book Another',
    languageSelector: 'Language',
    loading: 'Loading...',
    today: 'Today',
    tomorrow: 'Tomorrow',
    pageNotFound: 'Booking page not found',
    invalidLink: 'This booking link is invalid or has expired.',
    service: 'Service',
    staffMember: 'Staff',
    date: 'Date',
    time: 'Time',
    nameRequired: 'Name is required',
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email',
    slotUnavailable: 'This time slot is no longer available',
    done: 'Done',
    download: 'Download',
    appointmentConfirmedTitle: 'Your Appointment Is Confirmed',
    bookedWith: 'Booked with',
    copiedToClipboard: 'Copied to clipboard!',
    duplicateEmail: 'A client with this email already exists.',
    duplicatePhone: 'A client with this phone number already exists.',
  },
  es: {
    bookAppointment: 'Reservar una Cita',
    selectStore: 'Seleccionar Ubicación',
    selectService: 'Seleccionar Servicio',
    selectStaff: 'Seleccionar Personal',
    selectDateTime: 'Seleccionar Fecha y Hora',
    yourDetails: 'Tus Datos',
    reviewConfirm: 'Revisar y Confirmar',
    confirmed: '¡Reserva Confirmada!',
    name: 'Nombre',
    email: 'Correo Electrónico',
    phone: 'Teléfono (opcional)',
    notes: 'Notas (opcional)',
    namePlaceholder: 'Tu nombre',
    emailPlaceholder: 'tu@email.com',
    phonePlaceholder: '+1 234 567 8900',
    notesPlaceholder: 'Alguna solicitud especial...',
    continue: 'Continuar',
    back: 'Atrás',
    confirmBooking: 'Confirmar Reserva',
    duration: 'Duración',
    minutes: 'min',
    price: 'Precio',
    free: 'Gratis',
    noServices: 'No hay servicios disponibles',
    noStores: 'No hay ubicaciones disponibles',
    noStaffForService: 'No hay personal disponible para este servicio',
    noStaffForServiceDesc: 'Selecciona "Cualquier Disponible" para continuar o prueba otro servicio.',
    location: 'Ubicación',
    noSlots: 'Sin horarios disponibles',
    noSlotsDesc: 'Por favor intenta otra fecha o servicio.',
    storeClosed: 'Esta ubicacion esta cerrada en esta fecha',
    storeClosedToday: 'Lo sentimos, la tienda está cerrada hoy.',
    locationClosedOnDate: 'Esta ubicación está cerrada en la fecha seleccionada. Por favor, elija otro día para continuar su reserva.',
    locationClosedApology: 'Nos disculpamos sinceramente por las molestias y esperamos poder atenderle pronto.',
    bookingClosedSelectedDateMessage: 'Esta ubicación está cerrada en la fecha seleccionada. Por favor, elija otro día para continuar su reserva. Nos disculpamos sinceramente por las molestias y esperamos poder atenderle pronto.',
    noAvailability: 'Sin disponibilidad para esta fecha',
    bookingError: 'Error en la reserva',
    tryAgain: 'Por favor intenta de nuevo',
    confirmationCode: 'Código de Confirmación',
    appointmentDetails: 'Detalles de la Cita',
    addToCalendar: 'Agregar al Calendario',
    shareBooking: 'Compartir',
    bookAnother: 'Reservar Otra',
    languageSelector: 'Idioma',
    loading: 'Cargando...',
    today: 'Hoy',
    tomorrow: 'Mañana',
    pageNotFound: 'Página de reservas no encontrada',
    invalidLink: 'Este enlace de reserva es inválido o ha expirado.',
    service: 'Servicio',
    staffMember: 'Personal',
    date: 'Fecha',
    time: 'Hora',
    nameRequired: 'El nombre es requerido',
    emailRequired: 'El correo es requerido',
    emailInvalid: 'Por favor ingresa un correo válido',
    slotUnavailable: 'Este horario ya no está disponible',
    done: 'Finalizar',
    download: 'Descargar',
    appointmentConfirmedTitle: 'Tu Cita Está Confirmada',
    bookedWith: 'Reservado con',
    copiedToClipboard: '¡Copiado al portapapeles!',
    duplicateEmail: 'Ya existe un cliente con este correo electrónico.',
    duplicatePhone: 'Ya existe un cliente con este número de teléfono.',
  },
  fr: {
    bookAppointment: 'Prendre Rendez-vous',
    selectStore: 'Choisir un Emplacement',
    selectService: 'Choisir un Service',
    selectStaff: 'Choisir le Personnel',
    selectDateTime: 'Choisir Date et Heure',
    yourDetails: 'Vos Coordonnées',
    reviewConfirm: 'Vérifier et Confirmer',
    confirmed: 'Réservation Confirmée !',
    name: 'Nom',
    email: 'Email',
    phone: 'Téléphone (optionnel)',
    notes: 'Notes (optionnel)',
    namePlaceholder: 'Votre nom',
    emailPlaceholder: 'votre@email.com',
    phonePlaceholder: '+33 1 23 45 67 89',
    notesPlaceholder: 'Demandes spéciales...',
    continue: 'Continuer',
    back: 'Retour',
    confirmBooking: 'Confirmer',
    duration: 'Durée',
    minutes: 'min',
    price: 'Prix',
    free: 'Gratuit',
    noServices: 'Aucun service disponible',
    noStores: 'Aucun emplacement disponible',
    noStaffForService: 'Aucun personnel disponible pour ce service',
    noStaffForServiceDesc: 'Sélectionnez "N\'importe qui" pour continuer ou essayez un autre service.',
    location: 'Emplacement',
    noSlots: 'Aucun créneau disponible',
    noSlotsDesc: 'Veuillez essayer une autre date ou service.',
    storeClosed: 'Cet emplacement est fermé à cette date',
    storeClosedToday: 'Désolé, le magasin est fermé aujourd\'hui.',
    locationClosedOnDate: 'Cet emplacement est fermé à la date sélectionnée. Veuillez choisir un autre jour pour continuer votre réservation.',
    locationClosedApology: 'Nous nous excusons sincèrement pour ce désagrément et nous réjouissons de vous accueillir.',
    bookingClosedSelectedDateMessage: 'Cet emplacement est fermé à la date sélectionnée. Veuillez choisir un autre jour pour continuer votre réservation. Nous nous excusons sincèrement pour ce désagrément et nous réjouissons de vous accueillir.',
    noAvailability: 'Aucune disponibilité pour cette date',
    bookingError: 'Échec de la réservation',
    tryAgain: 'Veuillez réessayer',
    confirmationCode: 'Code de Confirmation',
    appointmentDetails: 'Détails du Rendez-vous',
    addToCalendar: 'Ajouter au Calendrier',
    shareBooking: 'Partager',
    bookAnother: 'Réserver un Autre',
    languageSelector: 'Langue',
    loading: 'Chargement...',
    today: 'Aujourd\'hui',
    tomorrow: 'Demain',
    pageNotFound: 'Page de réservation introuvable',
    invalidLink: 'Ce lien de réservation est invalide ou a expiré.',
    service: 'Service',
    staffMember: 'Personnel',
    date: 'Date',
    time: 'Heure',
    nameRequired: 'Le nom est requis',
    emailRequired: 'L\'email est requis',
    emailInvalid: 'Veuillez entrer un email valide',
    slotUnavailable: 'Ce créneau n\'est plus disponible',
    done: 'Terminé',
    download: 'Télécharger',
    appointmentConfirmedTitle: 'Votre Rendez-vous Est Confirmé',
    bookedWith: 'Réservé avec',
    copiedToClipboard: 'Copié dans le presse-papiers!',
    duplicateEmail: 'Un client avec cet e-mail existe déjà.',
    duplicatePhone: 'Un client avec ce numéro de téléphone existe déjà.',
  },
  de: {
    bookAppointment: 'Termin Buchen',
    selectStore: 'Standort Wählen',
    selectService: 'Service Wählen',
    selectStaff: 'Mitarbeiter Wählen',
    selectDateTime: 'Datum & Zeit Wählen',
    yourDetails: 'Ihre Daten',
    reviewConfirm: 'Überprüfen & Bestätigen',
    confirmed: 'Buchung Bestätigt!',
    name: 'Name',
    email: 'E-Mail',
    phone: 'Telefon (optional)',
    notes: 'Notizen (optional)',
    namePlaceholder: 'Ihr Name',
    emailPlaceholder: 'ihre@email.de',
    phonePlaceholder: '+49 123 456 7890',
    notesPlaceholder: 'Besondere Wünsche...',
    continue: 'Weiter',
    back: 'Zurück',
    confirmBooking: 'Bestätigen',
    duration: 'Dauer',
    minutes: 'Min',
    price: 'Preis',
    free: 'Kostenlos',
    noServices: 'Keine Services verfügbar',
    noStores: 'Keine Standorte verfügbar',
    noStaffForService: 'Kein Personal für diesen Service verfügbar',
    noStaffForServiceDesc: 'Wählen Sie "Beliebig verfügbar" oder versuchen Sie einen anderen Service.',
    location: 'Standort',
    noSlots: 'Keine Zeiten verfügbar',
    noSlotsDesc: 'Bitte versuchen Sie ein anderes Datum.',
    storeClosed: 'Dieser Standort ist an diesem Datum geschlossen',
    storeClosedToday: 'Entschuldigung, das Geschäft ist heute geschlossen.',
    locationClosedOnDate: 'Dieser Standort ist am ausgewählten Datum geschlossen. Bitte wählen Sie einen anderen Tag, um Ihre Buchung fortzusetzen.',
    locationClosedApology: 'Wir entschuldigen uns aufrichtig für die Unannehmlichkeiten und freuen uns darauf, Sie zu bedienen.',
    bookingClosedSelectedDateMessage: 'Dieser Standort ist am ausgewählten Datum geschlossen. Bitte wählen Sie einen anderen Tag, um Ihre Buchung fortzusetzen. Wir entschuldigen uns aufrichtig für die Unannehmlichkeiten und freuen uns darauf, Sie zu bedienen.',
    noAvailability: 'Keine Verfügbarkeit für dieses Datum',
    bookingError: 'Buchung fehlgeschlagen',
    tryAgain: 'Bitte versuchen Sie es erneut',
    confirmationCode: 'Bestätigungscode',
    appointmentDetails: 'Termindetails',
    addToCalendar: 'Zum Kalender hinzufügen',
    shareBooking: 'Teilen',
    bookAnother: 'Weitere Buchung',
    languageSelector: 'Sprache',
    loading: 'Laden...',
    today: 'Heute',
    tomorrow: 'Morgen',
    pageNotFound: 'Buchungsseite nicht gefunden',
    invalidLink: 'Dieser Buchungslink ist ungültig oder abgelaufen.',
    service: 'Service',
    staffMember: 'Mitarbeiter',
    date: 'Datum',
    time: 'Uhrzeit',
    nameRequired: 'Name ist erforderlich',
    emailRequired: 'E-Mail ist erforderlich',
    emailInvalid: 'Bitte geben Sie eine gültige E-Mail ein',
    slotUnavailable: 'Dieser Zeitslot ist nicht mehr verfügbar',
    done: 'Fertig',
    download: 'Herunterladen',
    appointmentConfirmedTitle: 'Ihr Termin Ist Bestätigt',
    bookedWith: 'Gebucht bei',
    copiedToClipboard: 'In die Zwischenablage kopiert!',
    duplicateEmail: 'Ein Kunde mit dieser E-Mail-Adresse existiert bereits.',
    duplicatePhone: 'Ein Kunde mit dieser Telefonnummer existiert bereits.',
  },
  pt: {
    bookAppointment: 'Agendar Consulta',
    selectStore: 'Selecionar Local',
    selectService: 'Selecionar Serviço',
    selectStaff: 'Selecionar Profissional',
    selectDateTime: 'Selecionar Data e Hora',
    yourDetails: 'Seus Dados',
    reviewConfirm: 'Revisar e Confirmar',
    confirmed: 'Agendamento Confirmado!',
    name: 'Nome',
    email: 'E-mail',
    phone: 'Telefone (opcional)',
    notes: 'Observações (opcional)',
    namePlaceholder: 'Seu nome',
    emailPlaceholder: 'seu@email.com',
    phonePlaceholder: '+55 11 99999-9999',
    notesPlaceholder: 'Algum pedido especial...',
    continue: 'Continuar',
    back: 'Voltar',
    confirmBooking: 'Confirmar',
    duration: 'Duração',
    minutes: 'min',
    price: 'Preço',
    free: 'Grátis',
    noServices: 'Nenhum serviço disponível',
    noStores: 'Nenhum local disponível',
    noStaffForService: 'Nenhum funcionário disponível para este serviço',
    noStaffForServiceDesc: 'Selecione "Qualquer Disponível" para continuar ou tente outro serviço.',
    location: 'Local',
    noSlots: 'Sem horários disponíveis',
    noSlotsDesc: 'Por favor tente outra data ou serviço.',
    storeClosed: 'Este local está fechado nesta data',
    storeClosedToday: 'Desculpe, a loja está fechada hoje.',
    locationClosedOnDate: 'Este local está fechado na data selecionada. Por favor, escolha outro dia para continuar seu agendamento.',
    locationClosedApology: 'Pedimos sinceras desculpas pelo inconveniente e aguardamos para atendê-lo.',
    bookingClosedSelectedDateMessage: 'Este local está fechado na data selecionada. Por favor, escolha outro dia para continuar seu agendamento. Pedimos sinceras desculpas pelo inconveniente e aguardamos para atendê-lo.',
    noAvailability: 'Sem disponibilidade para esta data',
    bookingError: 'Falha no agendamento',
    tryAgain: 'Por favor tente novamente',
    confirmationCode: 'Código de Confirmação',
    appointmentDetails: 'Detalhes da Consulta',
    addToCalendar: 'Adicionar ao Calendário',
    shareBooking: 'Compartilhar',
    bookAnother: 'Agendar Outro',
    languageSelector: 'Idioma',
    loading: 'Carregando...',
    today: 'Hoje',
    tomorrow: 'Amanhã',
    pageNotFound: 'Página de agendamento não encontrada',
    invalidLink: 'Este link de agendamento é inválido ou expirou.',
    service: 'Serviço',
    staffMember: 'Profissional',
    date: 'Data',
    time: 'Hora',
    nameRequired: 'Nome é obrigatório',
    emailRequired: 'E-mail é obrigatório',
    emailInvalid: 'Por favor insira um e-mail válido',
    slotUnavailable: 'Este horário não está mais disponível',
    done: 'Concluído',
    download: 'Baixar',
    appointmentConfirmedTitle: 'Seu Agendamento Está Confirmado',
    bookedWith: 'Agendado com',
    copiedToClipboard: 'Copiado para a área de transferência!',
    duplicateEmail: 'Já existe um cliente com este e-mail.',
    duplicatePhone: 'Já existe um cliente com este número de telefone.',
  },
  // Add minimal translations for other languages (fallback to English for missing keys)
  it: { bookAppointment: 'Prenota un Appuntamento', selectService: 'Seleziona Servizio', continue: 'Continua', back: 'Indietro', confirmBooking: 'Conferma', confirmed: 'Prenotazione Confermata!', loading: 'Caricamento...', name: 'Nome', email: 'Email', phone: 'Telefono (opzionale)', notes: 'Note (opzionale)', noStaffForService: 'Nessun personale disponibile per questo servizio', noStaffForServiceDesc: 'Seleziona "Qualsiasi Disponibile" per continuare o prova un altro servizio.', storeClosedToday: 'Spiacenti, il negozio è chiuso oggi.', locationClosedOnDate: 'Questa sede è chiusa nella data selezionata. Si prega di scegliere un altro giorno per continuare la prenotazione.', locationClosedApology: 'Ci scusiamo sinceramente per l\'inconveniente e non vediamo l\'ora di assistervi.', bookingClosedSelectedDateMessage: 'Questa sede è chiusa nella data selezionata. Si prega di scegliere un altro giorno per continuare la prenotazione. Ci scusiamo sinceramente per l\'inconveniente e non vediamo l\'ora di assistervi.', duplicateEmail: 'Esiste già un cliente con questa email.', duplicatePhone: 'Esiste già un cliente con questo numero di telefono.' },
  nl: { bookAppointment: 'Afspraak Maken', selectService: 'Selecteer Dienst', continue: 'Doorgaan', back: 'Terug', confirmBooking: 'Bevestigen', confirmed: 'Boeking Bevestigd!', loading: 'Laden...', name: 'Naam', email: 'E-mail', phone: 'Telefoon (optioneel)', notes: 'Notities (optioneel)', noStaffForService: 'Geen personeel beschikbaar voor deze dienst', noStaffForServiceDesc: 'Selecteer "Iedereen Beschikbaar" om door te gaan of probeer een andere dienst.', storeClosedToday: 'Sorry, de winkel is vandaag gesloten.', locationClosedOnDate: 'Deze locatie is gesloten op de geselecteerde datum. Kies alstublieft een andere dag om uw boeking voort te zetten.', locationClosedApology: 'Wij bieden onze oprechte excuses aan voor het ongemak en kijken ernaar uit u te helpen.', bookingClosedSelectedDateMessage: 'Deze locatie is gesloten op de geselecteerde datum. Kies alstublieft een andere dag om uw boeking voort te zetten. Wij bieden onze oprechte excuses aan voor het ongemak en kijken ernaar uit u te helpen.', duplicateEmail: 'Er bestaat al een klant met dit e-mailadres.', duplicatePhone: 'Er bestaat al een klant met dit telefoonnummer.' },
  sv: { bookAppointment: 'Boka en Tid', selectService: 'Välj Tjänst', continue: 'Fortsätt', back: 'Tillbaka', confirmBooking: 'Bekräfta', confirmed: 'Bokning Bekräftad!', loading: 'Laddar...', name: 'Namn', email: 'E-post', phone: 'Telefon (valfritt)', notes: 'Anteckningar (valfritt)', noStaffForService: 'Ingen personal tillgänglig för denna tjänst', noStaffForServiceDesc: 'Välj "Vem som helst" för att fortsätta eller prova en annan tjänst.', storeClosedToday: 'Tyvärr, butiken är stängd idag.', locationClosedOnDate: 'Denna plats är stängd på det valda datumet. Vänligen välj en annan dag för att fortsätta din bokning.', locationClosedApology: 'Vi ber uppriktigt om ursäkt för besväret och ser fram emot att hjälpa dig.', bookingClosedSelectedDateMessage: 'Denna plats är stängd på det valda datumet. Vänligen välj en annan dag för att fortsätta din bokning. Vi ber uppriktigt om ursäkt för besväret och ser fram emot att hjälpa dig.', duplicateEmail: 'En kund med denna e-postadress finns redan.', duplicatePhone: 'En kund med detta telefonnummer finns redan.' },
  no: { bookAppointment: 'Book en Time', selectService: 'Velg Tjeneste', continue: 'Fortsett', back: 'Tilbake', confirmBooking: 'Bekreft', confirmed: 'Booking Bekreftet!', loading: 'Laster...', name: 'Navn', email: 'E-post', phone: 'Telefon (valgfritt)', notes: 'Notater (valgfritt)', noStaffForService: 'Ingen ansatte tilgjengelig for denne tjenesten', noStaffForServiceDesc: 'Velg "Hvem som helst" for å fortsette eller prøv en annen tjeneste.', storeClosedToday: 'Beklager, butikken er stengt i dag.', locationClosedOnDate: 'Dette stedet er stengt på den valgte datoen. Vennligst velg en annen dag for å fortsette bookingen.', locationClosedApology: 'Vi beklager oppriktig ulempen og ser frem til å hjelpe deg.', bookingClosedSelectedDateMessage: 'Dette stedet er stengt på den valgte datoen. Vennligst velg en annen dag for å fortsette bookingen. Vi beklager oppriktig ulempen og ser frem til å hjelpe deg.', duplicateEmail: 'En kunde med denne e-postadressen finnes allerede.', duplicatePhone: 'En kunde med dette telefonnummeret finnes allerede.' },
  da: { bookAppointment: 'Book en Tid', selectService: 'Vælg Service', continue: 'Fortsæt', back: 'Tilbage', confirmBooking: 'Bekræft', confirmed: 'Booking Bekræftet!', loading: 'Indlæser...', name: 'Navn', email: 'E-mail', phone: 'Telefon (valgfrit)', notes: 'Noter (valgfrit)', noStaffForService: 'Ingen medarbejdere tilgængelige for denne service', noStaffForServiceDesc: 'Vælg "Enhver Tilgængelig" for at fortsætte eller prøv en anden service.', storeClosedToday: 'Beklager, butikken er lukket i dag.', locationClosedOnDate: 'Denne lokation er lukket på den valgte dato. Vælg venligst en anden dag for at fortsætte din booking.', locationClosedApology: 'Vi beklager oprigtigt ulejligheden og ser frem til at hjælpe dig.', bookingClosedSelectedDateMessage: 'Denne lokation er lukket på den valgte dato. Vælg venligst en anden dag for at fortsætte din booking. Vi beklager oprigtigt ulejligheden og ser frem til at hjælpe dig.', duplicateEmail: 'Der findes allerede en kunde med denne e-mailadresse.', duplicatePhone: 'Der findes allerede en kunde med dette telefonnummer.' },
  fi: { bookAppointment: 'Varaa Aika', selectService: 'Valitse Palvelu', continue: 'Jatka', back: 'Takaisin', confirmBooking: 'Vahvista', confirmed: 'Varaus Vahvistettu!', loading: 'Ladataan...', name: 'Nimi', email: 'Sähköposti', phone: 'Puhelin (valinnainen)', notes: 'Muistiinpanot (valinnainen)', noStaffForService: 'Ei henkilökuntaa saatavilla tälle palvelulle', noStaffForServiceDesc: 'Valitse "Kuka tahansa" jatkaaksesi tai kokeile toista palvelua.', storeClosedToday: 'Valitettavasti kauppa on suljettu tänään.', locationClosedOnDate: 'Tämä toimipiste on suljettu valittuna päivänä. Valitse toinen päivä jatkaaksesi varaustasi.', locationClosedApology: 'Pahoittelemme vilpittömästi aiheutunutta haittaa ja odotamme innolla palvelemista.', bookingClosedSelectedDateMessage: 'Tämä toimipiste on suljettu valittuna päivänä. Valitse toinen päivä jatkaaksesi varaustasi. Pahoittelemme vilpittömästi aiheutunutta haittaa ja odotamme innolla palvelemista.', duplicateEmail: 'Asiakas tällä sähköpostiosoitteella on jo olemassa.', duplicatePhone: 'Asiakas tällä puhelinnumerolla on jo olemassa.' },
  is: { bookAppointment: 'Bóka Tíma', selectService: 'Veldu Þjónustu', continue: 'Halda áfram', back: 'Til baka', confirmBooking: 'Staðfesta', confirmed: 'Bókun Staðfest!', loading: 'Hleður...', name: 'Nafn', email: 'Netfang', phone: 'Sími (valfrjálst)', notes: 'Athugasemdir (valfrjálst)', noStaffForService: 'Enginn starfsmaður tiltækur fyrir þessa þjónustu', noStaffForServiceDesc: 'Veldu "Hver sem er" til að halda áfram eða prófaðu aðra þjónustu.', storeClosedToday: 'Því miður, verslunin er lokuð í dag.', locationClosedOnDate: 'Þessi staðsetning er lokuð á völdum degi. Vinsamlegast veldu annan dag til að halda áfram með bókun þína.', locationClosedApology: 'Við biðjumst einlæglega afsökunar á óþægindunum og hlökkum til að þjóna þér.', bookingClosedSelectedDateMessage: 'Þessi staðsetning er lokuð á völdum degi. Vinsamlegast veldu annan dag til að halda áfram með bókun þína. Við biðjumst einlæglega afsökunar á óþægindunum og hlökkum til að þjóna þér.', duplicateEmail: 'Viðskiptavinur með þetta netfang er þegar til.', duplicatePhone: 'Viðskiptavinur með þetta símanúmer er þegar til.' },
  ru: { bookAppointment: 'Записаться', selectService: 'Выбрать Услугу', continue: 'Продолжить', back: 'Назад', confirmBooking: 'Подтвердить', confirmed: 'Запись Подтверждена!', loading: 'Загрузка...', name: 'Имя', email: 'Email', phone: 'Телефон (необязательно)', notes: 'Примечания (необязательно)', noStaffForService: 'Нет сотрудников для этой услуги', noStaffForServiceDesc: 'Выберите "Любой доступный" или попробуйте другую услугу.', storeClosedToday: 'Извините, магазин сегодня закрыт.', locationClosedOnDate: 'Это место закрыто в выбранную дату. Пожалуйста, выберите другой день для продолжения бронирования.', locationClosedApology: 'Приносим искренние извинения за неудобства и с нетерпением ждём возможности помочь вам.', bookingClosedSelectedDateMessage: 'Это место закрыто в выбранную дату. Пожалуйста, выберите другой день для продолжения бронирования. Приносим искренние извинения за неудобства и с нетерпением ждём возможности помочь вам.', duplicateEmail: 'Клиент с таким адресом электронной почты уже существует.', duplicatePhone: 'Клиент с таким номером телефона уже существует.' },
  tr: { bookAppointment: 'Randevu Al', selectService: 'Hizmet Seç', continue: 'Devam', back: 'Geri', confirmBooking: 'Onayla', confirmed: 'Rezervasyon Onaylandı!', loading: 'Yükleniyor...', name: 'İsim', email: 'E-posta', phone: 'Telefon (opsiyonel)', notes: 'Notlar (opsiyonel)', noStaffForService: 'Bu hizmet için personel yok', noStaffForServiceDesc: '"Herhangi Biri" seçerek devam edin veya başka bir hizmet deneyin.', storeClosedToday: 'Üzgünüz, mağaza bugün kapalı.', locationClosedOnDate: 'Bu konum seçilen tarihte kapalıdır. Rezervasyonunuza devam etmek için lütfen başka bir gün seçin.', locationClosedApology: 'Yaşanan rahatsızlık için içtenlikle özür dileriz ve size hizmet etmeyi dört gözle bekliyoruz.', bookingClosedSelectedDateMessage: 'Bu konum seçilen tarihte kapalıdır. Rezervasyonunuza devam etmek için lütfen başka bir gün seçin. Yaşanan rahatsızlık için içtenlikle özür dileriz ve size hizmet etmeyi dört gözle bekliyoruz.', duplicateEmail: 'Bu e-posta adresine sahip bir müşteri zaten mevcut.', duplicatePhone: 'Bu telefon numarasına sahip bir müşteri zaten mevcut.' },
  zh: { bookAppointment: '预约', selectService: '选择服务', continue: '继续', back: '返回', confirmBooking: '确认预约', confirmed: '预约已确认！', loading: '加载中...', name: '姓名', email: '邮箱', phone: '电话（可选）', notes: '备注（可选）', noStaffForService: '该服务暂无可用员工', noStaffForServiceDesc: '选择"任意可用"继续，或尝试其他服务。', storeClosedToday: '抱歉，店铺今天休息。', locationClosedOnDate: '该地点在所选日期关闭。请选择其他日期继续预约。', locationClosedApology: '对于造成的不便，我们深表歉意，期待为您服务。', bookingClosedSelectedDateMessage: '该地点在所选日期关闭。请选择其他日期继续预约。对于造成的不便，我们深表歉意，期待为您服务。', duplicateEmail: '已存在使用此电子邮件的客户。', duplicatePhone: '已存在使用此电话号码的客户。' },
  ko: { bookAppointment: '예약하기', selectService: '서비스 선택', continue: '계속', back: '뒤로', confirmBooking: '확인', confirmed: '예약 완료!', loading: '로딩...', name: '이름', email: '이메일', phone: '전화번호 (선택)', notes: '메모 (선택)', noStaffForService: '이 서비스에 가능한 직원이 없습니다', noStaffForServiceDesc: '"아무나 가능"을 선택하거나 다른 서비스를 시도하세요.', storeClosedToday: '죄송합니다, 오늘은 매장이 휴무입니다.', locationClosedOnDate: '선택하신 날짜에는 이 매장이 휴무입니다. 예약을 계속하시려면 다른 날짜를 선택해 주세요.', locationClosedApology: '불편을 드려 진심으로 사과드리며, 곧 찾아뵙기를 기대합니다.', bookingClosedSelectedDateMessage: '선택하신 날짜에는 이 매장이 휴무입니다. 예약을 계속하시려면 다른 날짜를 선택해 주세요. 불편을 드려 진심으로 사과드리며, 곧 찾아뵙기를 기대합니다.', duplicateEmail: '이 이메일 주소를 가진 고객이 이미 존재합니다.', duplicatePhone: '이 전화번호를 가진 고객이 이미 존재합니다.' },
  ja: { bookAppointment: '予約する', selectService: 'サービスを選択', continue: '続ける', back: '戻る', confirmBooking: '確認', confirmed: '予約完了！', loading: '読み込み中...', name: '名前', email: 'メール', phone: '電話番号（任意）', notes: 'メモ（任意）', noStaffForService: 'このサービスに対応できるスタッフがいません', noStaffForServiceDesc: '「誰でも可」を選択するか、別のサービスをお試しください。', storeClosedToday: '申し訳ございません、本日は店舗が休業です。', locationClosedOnDate: '選択された日付はこの店舗は休業となっております。ご予約を続けるには別の日をお選びください。', locationClosedApology: 'ご不便をおかけして誠に申し訳ございません。またのご利用を心よりお待ちしております。', bookingClosedSelectedDateMessage: '選択された日付はこの店舗は休業となっております。ご予約を続けるには別の日をお選びください。ご不便をおかけして誠に申し訳ございません。またのご利用を心よりお待ちしております。', duplicateEmail: 'このメールアドレスを持つ顧客はすでに存在します。', duplicatePhone: 'この電話番号を持つ顧客はすでに存在します。' },
  ht: { bookAppointment: 'Rezève yon Randevou', selectService: 'Chwazi Sèvis', continue: 'Kontinye', back: 'Retounen', confirmBooking: 'Konfime', confirmed: 'Rezèvasyon Konfime!', loading: 'Chajman...', name: 'Non', email: 'Imèl', phone: 'Telefòn (opsyonèl)', notes: 'Nòt (opsyonèl)', noStaffForService: 'Pa gen pèsonèl disponib pou sèvis sa a', noStaffForServiceDesc: 'Chwazi "Nenpòt Disponib" pou kontinye oswa eseye yon lòt sèvis.', storeClosedToday: 'Eskize nou, magazen an fèmen jodi a.', locationClosedOnDate: 'Kote sa a fèmen nan dat ou chwazi a. Tanpri chwazi yon lòt jou pou kontinye rezèvasyon ou.', locationClosedApology: 'Nou mande padon sensèman pou deranjman an epi nou espere wè ou byento.', bookingClosedSelectedDateMessage: 'Kote sa a fèmen nan dat ou chwazi a. Tanpri chwazi yon lòt jou pou kontinye rezèvasyon ou. Nou mande padon sensèman pou deranjman an epi nou espere wè ou byento.', duplicateEmail: 'Yon kliyan ak imèl sa a egziste deja.', duplicatePhone: 'Yon kliyan ak nimewo telefòn sa a egziste deja.' },
} as any;

// Get translation with fallback to English
function getBookingText(locale: Language, key: string): string {
  return bookingTranslations[locale]?.[key] || bookingTranslations.en[key] || key;
}

// Common service name translations (case-insensitive lookup)
const serviceNameTranslations: Record<string, Record<string, string>> = {
  // English service names to other languages
  'haircut': { es: 'Corte de Cabello', fr: 'Coupe de Cheveux', de: 'Haarschnitt', pt: 'Corte de Cabelo', it: 'Taglio di Capelli' },
  'hair cut': { es: 'Corte de Cabello', fr: 'Coupe de Cheveux', de: 'Haarschnitt', pt: 'Corte de Cabelo', it: 'Taglio di Capelli' },
  'men\'s haircut': { es: 'Corte de Cabello para Hombre', fr: 'Coupe Homme', de: 'Herrenhaarschnitt', pt: 'Corte Masculino', it: 'Taglio Uomo' },
  'women\'s haircut': { es: 'Corte de Cabello para Mujer', fr: 'Coupe Femme', de: 'Damenhaarschnitt', pt: 'Corte Feminino', it: 'Taglio Donna' },
  'kids haircut': { es: 'Corte de Cabello Infantil', fr: 'Coupe Enfant', de: 'Kinderhaarschnitt', pt: 'Corte Infantil', it: 'Taglio Bambino' },
  'child haircut': { es: 'Corte de Cabello Infantil', fr: 'Coupe Enfant', de: 'Kinderhaarschnitt', pt: 'Corte Infantil', it: 'Taglio Bambino' },
  'beard trim': { es: 'Recorte de Barba', fr: 'Taille de Barbe', de: 'Bartschnitt', pt: 'Aparar Barba', it: 'Rifinitura Barba' },
  'shave': { es: 'Afeitado', fr: 'Rasage', de: 'Rasur', pt: 'Barbear', it: 'Rasatura' },
  'hot towel shave': { es: 'Afeitado con Toalla Caliente', fr: 'Rasage Serviette Chaude', de: 'Heißtuch-Rasur', pt: 'Barbear com Toalha Quente', it: 'Rasatura con Asciugamano Caldo' },
  'hair color': { es: 'Color de Cabello', fr: 'Coloration', de: 'Haarfarbe', pt: 'Coloração', it: 'Colore Capelli' },
  'hair coloring': { es: 'Coloración de Cabello', fr: 'Coloration', de: 'Haarfärbung', pt: 'Coloração de Cabelo', it: 'Colorazione Capelli' },
  'highlights': { es: 'Mechas', fr: 'Mèches', de: 'Strähnchen', pt: 'Mechas', it: 'Meches' },
  'balayage': { es: 'Balayage', fr: 'Balayage', de: 'Balayage', pt: 'Balayage', it: 'Balayage' },
  'blowout': { es: 'Secado con Brushing', fr: 'Brushing', de: 'Föhnen', pt: 'Escova', it: 'Piega' },
  'blow dry': { es: 'Secado', fr: 'Brushing', de: 'Föhnen', pt: 'Escova', it: 'Piega' },
  'styling': { es: 'Peinado', fr: 'Coiffure', de: 'Styling', pt: 'Penteado', it: 'Acconciatura' },
  'updo': { es: 'Peinado Recogido', fr: 'Chignon', de: 'Hochsteckfrisur', pt: 'Penteado Preso', it: 'Acconciatura Raccolta' },
  'perm': { es: 'Permanente', fr: 'Permanente', de: 'Dauerwelle', pt: 'Permanente', it: 'Permanente' },
  'keratin treatment': { es: 'Tratamiento de Keratina', fr: 'Traitement Kératine', de: 'Keratinbehandlung', pt: 'Tratamento de Queratina', it: 'Trattamento alla Cheratina' },
  'deep conditioning': { es: 'Acondicionamiento Profundo', fr: 'Soin Profond', de: 'Tiefenpflege', pt: 'Hidratação Profunda', it: 'Trattamento Intensivo' },
  'scalp treatment': { es: 'Tratamiento del Cuero Cabelludo', fr: 'Traitement du Cuir Chevelu', de: 'Kopfhautbehandlung', pt: 'Tratamento do Couro Cabeludo', it: 'Trattamento del Cuoio Capelluto' },
  'hair extensions': { es: 'Extensiones de Cabello', fr: 'Extensions de Cheveux', de: 'Haarverlängerungen', pt: 'Extensões de Cabelo', it: 'Extension Capelli' },
  'manicure': { es: 'Manicura', fr: 'Manucure', de: 'Maniküre', pt: 'Manicure', it: 'Manicure' },
  'pedicure': { es: 'Pedicura', fr: 'Pédicure', de: 'Pediküre', pt: 'Pedicure', it: 'Pedicure' },
  'gel nails': { es: 'Uñas de Gel', fr: 'Ongles en Gel', de: 'Gelnägel', pt: 'Unhas de Gel', it: 'Unghie in Gel' },
  'acrylic nails': { es: 'Uñas Acrílicas', fr: 'Ongles en Acrylique', de: 'Acrylnägel', pt: 'Unhas Acrílicas', it: 'Unghie Acriliche' },
  'nail art': { es: 'Decoración de Uñas', fr: 'Nail Art', de: 'Nagelkunst', pt: 'Nail Art', it: 'Nail Art' },
  'facial': { es: 'Facial', fr: 'Soin du Visage', de: 'Gesichtsbehandlung', pt: 'Facial', it: 'Trattamento Viso' },
  'deep cleansing facial': { es: 'Limpieza Facial Profunda', fr: 'Soin Nettoyant Profond', de: 'Tiefenreinigung Gesicht', pt: 'Limpeza de Pele Profunda', it: 'Pulizia Profonda Viso' },
  'massage': { es: 'Masaje', fr: 'Massage', de: 'Massage', pt: 'Massagem', it: 'Massaggio' },
  'swedish massage': { es: 'Masaje Sueco', fr: 'Massage Suédois', de: 'Schwedische Massage', pt: 'Massagem Sueca', it: 'Massaggio Svedese' },
  'deep tissue massage': { es: 'Masaje de Tejido Profundo', fr: 'Massage des Tissus Profonds', de: 'Tiefengewebsmassage', pt: 'Massagem Profunda', it: 'Massaggio dei Tessuti Profondi' },
  'hot stone massage': { es: 'Masaje con Piedras Calientes', fr: 'Massage aux Pierres Chaudes', de: 'Hot Stone Massage', pt: 'Massagem com Pedras Quentes', it: 'Massaggio con Pietre Calde' },
  'waxing': { es: 'Depilación con Cera', fr: 'Épilation à la Cire', de: 'Wachsen', pt: 'Depilação com Cera', it: 'Ceretta' },
  'eyebrow wax': { es: 'Depilación de Cejas', fr: 'Épilation des Sourcils', de: 'Augenbrauen Wachsen', pt: 'Depilação de Sobrancelhas', it: 'Ceretta Sopracciglia' },
  'eyebrow threading': { es: 'Depilación de Cejas con Hilo', fr: 'Épilation au Fil des Sourcils', de: 'Augenbrauen Fadentechnik', pt: 'Design de Sobrancelhas com Linha', it: 'Threading Sopracciglia' },
  'eyebrow tinting': { es: 'Tinte de Cejas', fr: 'Teinture des Sourcils', de: 'Augenbrauen Färben', pt: 'Tintura de Sobrancelhas', it: 'Tinta Sopracciglia' },
  'eyelash extensions': { es: 'Extensiones de Pestañas', fr: 'Extensions de Cils', de: 'Wimpernverlängerungen', pt: 'Extensões de Cílios', it: 'Extension Ciglia' },
  'lash lift': { es: 'Lifting de Pestañas', fr: 'Rehaussement de Cils', de: 'Wimpernlifting', pt: 'Lifting de Cílios', it: 'Laminazione Ciglia' },
  'makeup': { es: 'Maquillaje', fr: 'Maquillage', de: 'Make-up', pt: 'Maquiagem', it: 'Trucco' },
  'bridal makeup': { es: 'Maquillaje de Novia', fr: 'Maquillage de Mariée', de: 'Braut Make-up', pt: 'Maquiagem de Noiva', it: 'Trucco Sposa' },
  'consultation': { es: 'Consulta', fr: 'Consultation', de: 'Beratung', pt: 'Consulta', it: 'Consulenza' },
  'teeth whitening': { es: 'Blanqueamiento Dental', fr: 'Blanchiment des Dents', de: 'Zahnaufhellung', pt: 'Clareamento Dental', it: 'Sbiancamento Denti' },
  'spray tan': { es: 'Bronceado en Spray', fr: 'Spray Bronzant', de: 'Sprühbräunung', pt: 'Bronzeamento Artificial', it: 'Spray Abbronzante' },
  'body wrap': { es: 'Envoltura Corporal', fr: 'Enveloppement Corporel', de: 'Körperwickel', pt: 'Bandagem Corporal', it: 'Impacco Corpo' },
  'microblading': { es: 'Microblading', fr: 'Microblading', de: 'Microblading', pt: 'Microblading', it: 'Microblading' },
  'laser hair removal': { es: 'Depilación Láser', fr: 'Épilation Laser', de: 'Laser-Haarentfernung', pt: 'Depilação a Laser', it: 'Epilazione Laser' },
  'botox': { es: 'Botox', fr: 'Botox', de: 'Botox', pt: 'Botox', it: 'Botox' },
  'fillers': { es: 'Rellenos', fr: 'Injections', de: 'Filler', pt: 'Preenchimentos', it: 'Filler' },
  'chemical peel': { es: 'Peeling Químico', fr: 'Peeling Chimique', de: 'Chemisches Peeling', pt: 'Peeling Químico', it: 'Peeling Chimico' },
  'microdermabrasion': { es: 'Microdermoabrasión', fr: 'Microdermabrasion', de: 'Mikrodermabrasion', pt: 'Microdermoabrasão', it: 'Microdermoabrasione' },
};

// Get translated service name (falls back to original if no translation found)
function getTranslatedServiceName(serviceName: string | undefined, locale: Language): string {
  if (!serviceName) return '';
  if (locale === 'en') return serviceName; // No need to translate if already English

  const lowerName = serviceName.toLowerCase().trim();
  const translations = serviceNameTranslations[lowerName];

  if (translations && translations[locale]) {
    return translations[locale];
  }

  // Return original name if no translation found
  return serviceName;
}

// ============================================
// StorePhotoThumb — renders store photo with error fallback
// ============================================

function StorePhotoThumb({ photoUrl, brandColor, brandColorLight, storeId }: {
  photoUrl: string | null | undefined;
  brandColor: string;
  brandColorLight: string;
  storeId?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (photoUrl && !failed) {
    const uri = photoUrl.includes('?') ? photoUrl : `${photoUrl}?v=1`;
    return (
      <View style={{ width: 72, height: 72, borderRadius: 10, marginRight: 14, overflow: 'hidden', flexShrink: 0, backgroundColor: 'transparent' }}>
        <Image
          source={{ uri }}
          style={{ width: 72, height: 72 }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  return (
    <View
      style={{ width: 72, height: 72, borderRadius: 10, marginRight: 14, backgroundColor: brandColorLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <Briefcase size={30} color={brandColor} />
    </View>
  );
}

// ============================================
// Main Component
// ============================================

export default function PublicBookingPage() {
  return (
    <ErrorBoundary flowName="Booking">
      <BookingPageInner />
    </ErrorBoundary>
  );
}

function BookingPageInner() {
  const params = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  // State
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Language>('en');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // LocalStorage key for persisting language choice
  const BOOKING_LANG_KEY = 'booking_lang';

  // Guard: tracks whether config has been fetched at least once in this component instance.
  // Prevents setLoading(true) from firing on any unexpected effect re-runs (Expo Router
  // route re-evaluations, React Strict Mode double-invoke, etc.) after first load completes.
  const configLoadedRef = useRef(false);

  // Booking flow state
  const [step, setStep] = useState<BookingStep>('landing');
  const [selectedStore, setSelectedStore] = useState<BookingConfig['stores'][0] | null>(null);
  const [selectedService, setSelectedService] = useState<BookingConfig['services'][0] | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<BookingConfig['staff'][0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<DaySlots[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [storeClosedToday, setStoreClosedToday] = useState(false);  // Track if selected store is closed today

  // Date closure status - checked BEFORE loading slots to prevent flicker
  const [dateClosureStatus, setDateClosureStatus] = useState<{
    is_closed: boolean;
    reason: 'override' | 'blackout' | 'weekly_closed' | 'no_hours' | 'open';
    checking: boolean;
  }>({ is_closed: false, reason: 'open', checking: false });

  // Effective hours from backend (respects overrides, single source of truth)
  const [effectiveHoursMap, setEffectiveHoursMap] = useState<Record<string, EffectiveHoursData>>({});

  // Service description modal state
  const [showServiceDescriptionModal, setShowServiceDescriptionModal] = useState(false);
  const [viewingServiceDescription, setViewingServiceDescription] = useState<{ name: string; description: string } | null>(null);

  // Customer form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Booking result
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showCopiedFeedback, setShowCopiedFeedback] = useState(false);

  // Debug panel state (toggle with long-press on Time header)
  // IMPORTANT: Set to false for production builds - no debug panel in public booking
  const DEBUG_BOOKING = false;
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    requestParams: Record<string, string | null> | null;
    requestUrl: string | null;
    rawResponse: unknown;
    responseError: { message: string; stack?: string; payload?: unknown } | null;
    daysCount: number;
    totalSlots: number;
    timestamp: string;
  }>({
    requestParams: null,
    requestUrl: null,
    rawResponse: null,
    responseError: null,
    daysCount: 0,
    totalSlots: 0,
    timestamp: '',
  });

  // Backend URL
  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

  // Get current booking page URL
  const getBookingUrl = useCallback(() => {
    if (Platform.OS === 'web') {
      return window.location.href.split('?')[0]; // Remove query params
    }
    // For native, construct the URL
    return `${backendUrl.replace('/api', '')}/book/${slug}`;
  }, [backendUrl, slug]);

  // Copy link handler
  const handleCopyLink = useCallback(async () => {
    try {
      const url = getBookingUrl();
      await Clipboard.setStringAsync(url);
      setShowCopiedFeedback(true);
      setTimeout(() => setShowCopiedFeedback(false), 2000);
    } catch (err) {
      console.error('[Booking] Copy link error:', err);
    }
  }, [getBookingUrl]);

  // Share handler
  const handleShare = useCallback(async () => {
    try {
      const url = getBookingUrl();
      const title = config?.business?.name ? `Book with ${config.business.name}` : 'Book an Appointment';

      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({ title, url });
      } else if (await Sharing.isAvailableAsync()) {
        // For native, we can't share URLs directly, so copy to clipboard instead
        await Clipboard.setStringAsync(url);
        setShowCopiedFeedback(true);
        setTimeout(() => setShowCopiedFeedback(false), 2000);
      } else {
        // Fallback to copy
        await handleCopyLink();
      }
    } catch (err) {
      // User cancelled share or error
      console.log('[Booking] Share cancelled or error:', err);
    }
  }, [getBookingUrl, config?.business?.name, handleCopyLink]);

  // Open in browser handler (web only)
  const handleOpenInBrowser = useCallback(() => {
    const url = getBookingUrl();
    Linking.openURL(url);
  }, [getBookingUrl]);

  // Translation helper
  const t = useCallback((key: string) => getBookingText(locale, key), [locale]);

  // Translated service name helper
  const getLocalizedServiceName = useCallback((serviceName: string | undefined) => {
    return getTranslatedServiceName(serviceName, locale);
  }, [locale]);

  // Brand color helper - use business branding or fallback to default
  const brandColor = config?.business?.brand_primary_color || DEFAULT_BRAND_COLOR;
  const brandColorLight = `${brandColor}15`; // 15% opacity for backgrounds
  const logoUrl = config?.business?.logo_url;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // ============================================
  // Load booking configuration
  // ============================================

  useEffect(() => {
    if (!slug) return;

    async function loadConfig() {
      // GUARD: if config was already fetched in this component instance, skip the full
      // blocking reload. This prevents the loading screen from appearing on any unexpected
      // effect re-run (e.g. Expo Router route re-evaluation, React Strict Mode, etc.).
      if (configLoadedRef.current) return;

      setLoading(true);
      setError(null);

      try {
        // Detect device locale
        const deviceLocale = Platform.OS === 'web'
          ? navigator?.language?.split('-')[0] || 'en'
          : 'en';

        // Get URL locale param
        const urlParams = Platform.OS === 'web' ? new URLSearchParams(window.location.search) : null;
        const urlLocale = urlParams?.get('lang') || undefined;

        // Get saved locale from localStorage (web only)
        let savedLocale: string | undefined;
        if (Platform.OS === 'web') {
          try {
            savedLocale = localStorage.getItem(BOOKING_LANG_KEY) || undefined;
          } catch (e) {
            // localStorage may be unavailable in some contexts
          }
        }

        const response = await fetch(
          `${backendUrl}/api/booking/config/${slug}?locale=${urlLocale || savedLocale || deviceLocale}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('not_found');
          } else {
            setError('load_error');
          }
          return;
        }

        const result = await response.json();
        const configData = result.data as BookingConfig;

        // DEBUG: Log stores with photos and hours
        console.log('[Booking] Config loaded - stores:', configData.stores?.map(s => ({
          id: s.id,
          name: s.name,
          blackout_dates: s.blackout_dates,
          photo_url: s.photo_url,
          photo_thumb_url: s.photo_thumb_url,
        })));

        setConfig(configData);

        // Resolve locale with priority: URL param > localStorage > device locale > default
        const enabledLocales = configData.booking_page_settings?.enabled_locales || ['en'];
        const defaultLocale = configData.booking_page_settings?.default_locale || 'en';
        const smartDetection = configData.booking_page_settings?.smart_language_detection ?? true;

        let resolvedLocale: Language = 'en';

        // Priority 1: URL parameter (if present AND enabled)
        if (urlLocale && enabledLocales.includes(urlLocale as Language)) {
          resolvedLocale = urlLocale as Language;
        }
        // Priority 2: localStorage saved choice (if enabled)
        else if (savedLocale && enabledLocales.includes(savedLocale as Language)) {
          resolvedLocale = savedLocale as Language;
        }
        // Priority 3: Device/browser locale (if smart detection enabled AND locale is enabled)
        else if (smartDetection && deviceLocale) {
          const normalizedDeviceLocale = deviceLocale.split('-')[0].toLowerCase();
          if (enabledLocales.includes(normalizedDeviceLocale as Language)) {
            resolvedLocale = normalizedDeviceLocale as Language;
          } else {
            resolvedLocale = defaultLocale as Language;
          }
        }
        // Priority 4: Default locale
        else {
          resolvedLocale = defaultLocale as Language;
        }

        // Fallback to English if resolved locale is not valid
        if (!enabledLocales.includes(resolvedLocale)) {
          resolvedLocale = 'en';
        }

        setLocale(resolvedLocale);

        // Mark config as loaded — future effect re-runs will skip the full reload
        configLoadedRef.current = true;

        // Save to localStorage for persistence.
        // NOTE: Do NOT call window.history.replaceState here — Expo Router on web
        // patches replaceState and treats ANY call as a navigation event, which
        // unmounts and remounts the component, resets loading=true, and leaves
        // the page stuck on the loading screen. Language is persisted via
        // localStorage only; the ?lang= URL param (if present) is intentionally
        // left in place since it reflects the user's arrival intent.
        if (Platform.OS === 'web') {
          try {
            localStorage.setItem(BOOKING_LANG_KEY, resolvedLocale);
          } catch (e) {
            // Ignore localStorage errors
          }
        }
      } catch (err) {
        console.error('[Booking] Load error:', err);
        setError('load_error');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [slug, backendUrl]);

  // ============================================
  // Load effective hours from backend (single source of truth)
  // Uses same override logic as get_available_slots
  // ============================================

  useEffect(() => {
    if (!config?.business?.id || !config?.stores?.length) return;

    async function loadEffectiveHours() {
      if (!config?.business?.id) return;

      try {
        console.log('[EffectiveHours] Fetching effective hours for business:', config.business.id);

        const params = new URLSearchParams({
          business_id: config.business.id,
          _t: Date.now().toString(), // Cache buster
        });

        const response = await fetch(`${backendUrl}/api/booking/effective-hours?${params}`);

        if (!response.ok) {
          console.error('[EffectiveHours] Failed to fetch:', response.status);
          return;
        }

        const result = await response.json();
        const hoursData = result.data;

        // Build map by store_id for easy lookup
        const hoursMap: Record<string, EffectiveHoursData> = {};

        if (Array.isArray(hoursData)) {
          for (const hours of hoursData) {
            hoursMap[hours.store_id] = hours;
            console.log(`[EffectiveHours] Store ${hours.store_name}: ${hours.formatted_hours || 'No hours'} (source: ${hours.source})`);
          }
        } else if (hoursData?.store_id) {
          // Single store response
          hoursMap[hoursData.store_id] = hoursData;
          console.log(`[EffectiveHours] Store ${hoursData.store_name}: ${hoursData.formatted_hours || 'No hours'} (source: ${hoursData.source})`);
        }

        setEffectiveHoursMap(hoursMap);
      } catch (err) {
        console.error('[EffectiveHours] Error fetching effective hours:', err);
      }
    }

    loadEffectiveHours();
  }, [config?.business?.id, config?.stores?.length, backendUrl]);

  // ============================================
  // DETERMINISTIC CLOSED DAY CHECK
  // Checks if a specific date is closed for the selected store
  // This runs BEFORE any API call to prevent loading/no-slots flicker
  // ============================================
  const isClosedDay = useCallback((dateStr: string, store: BookingConfig['stores'][0] | null): boolean => {
    if (!store || !dateStr) {
      console.log('[Booking] isClosedDay: FALSE (no store or date)');
      return false;
    }

    console.log('[Booking] isClosedDay checking:', {
      dateStr,
      storeId: store.id,
      blackout_dates: store.blackout_dates,
      hasHours: !!store.hours?.length,
    });

    // 1. Check if date is a BLACKOUT DATE
    const isBlackoutDate = store.blackout_dates?.includes(dateStr) ?? false;
    if (isBlackoutDate) {
      console.log('[Booking] isClosedDay: TRUE (blackout date)', dateStr);
      return true;
    }

    // 2. Check if date is CLOSED by business hours
    const checkDate = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
    const dayOfWeek = checkDate.getDay(); // 0=Sunday, 6=Saturday

    // Check store_hours_overrides first (highest priority)
    if (config?.store_hours_overrides) {
      const override = config.store_hours_overrides.find(o => {
        if (o.store_id !== store.id) return false;
        return dateStr >= o.start_date && dateStr <= o.end_date;
      });
      if (override) {
        if (override.is_closed) {
          console.log('[Booking] isClosedDay: TRUE (override closed)', dateStr);
          return true;
        }
        // Override exists and is NOT closed - store is open
        console.log('[Booking] isClosedDay: FALSE (override open)', dateStr);
        return false;
      }
    }

    // Check weekly business hours from store.hours
    if (store.hours && store.hours.length > 0) {
      const hoursForDay = store.hours.find(h => h.day_of_week === dayOfWeek);

      if (hoursForDay) {
        if (hoursForDay.is_closed) {
          console.log('[Booking] isClosedDay: TRUE (weekly hours closed)', dateStr, 'dayOfWeek:', dayOfWeek);
          return true;
        }
        // Hours exist and not closed - store is open
        console.log('[Booking] isClosedDay: FALSE (store open on this day)', dateStr, 'dayOfWeek:', dayOfWeek);
        return false;
      } else {
        // No hours defined for this day - treat as closed
        console.log('[Booking] isClosedDay: TRUE (no hours defined for day)', dateStr, 'dayOfWeek:', dayOfWeek);
        return true;
      }
    }

    // No hours configured at all - don't assume closed (backend will decide)
    console.log('[Booking] isClosedDay: FALSE (no hours configured, letting backend decide)');
    return false;
  }, [config?.store_hours_overrides]);

  // ============================================
  // Load available slots when service/staff changes
  // IMPORTANT: First check if the starting date (today) is closed before fetching slots
  // This prevents the "loading" -> "no slots" flicker when store is closed
  // ============================================

  useEffect(() => {
    if (!config || !selectedService) return;

    async function loadSlotsWithClosureCheck() {
      if (!config || !selectedService) return;

      console.log('[Booking] loadSlotsWithClosureCheck START service=' + selectedService.id + ' staff=' + (selectedStaff?.id || 'none') + ' store=' + (selectedStore?.id || 'none'));

      // Clear previous state
      setAvailableSlots([]);

      // ============================================
      // DETERMINE THE START DATE FOR BOOKING
      // Check URL params (web) or use today as default
      // ============================================
      let startDateStr = new Date().toISOString().split('T')[0] as string;

      // On web, check if there's a date in URL params
      if (Platform.OS === 'web') {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const urlDate = urlParams.get('date');
          if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
            startDateStr = urlDate;
            console.log('[Booking] Using date from URL:', startDateStr);
          }
        } catch (e) {
          // Ignore URL parsing errors
        }
      }

      console.log('[Booking] Checking if store is closed on:', startDateStr);
      console.log('[Booking] Store blackout_dates:', selectedStore?.blackout_dates);

      // ============================================
      // STEP 1: DETERMINISTIC CLOSED DAY CHECK (NO API CALL)
      // Check if store is closed on starting date BEFORE any loading
      // This is instant - no flicker, no loading spinner
      // ============================================
      if (selectedStore && isClosedDay(startDateStr, selectedStore)) {
        console.log('[Booking] loadSlotsWithClosureCheck: store CLOSED on ' + startDateStr + ' — exiting loading, no fetch');
        setDateClosureStatus({
          is_closed: true,
          reason: 'blackout', // Could be blackout, weekly_closed, or no_hours
          checking: false,
        });
        setSlotsLoading(false);
        return; // Don't fetch slots - store is closed
      }

      // STEP 2: Store is open on start date - now fetch available slots (show loading indicator)
      setDateClosureStatus({ is_closed: false, reason: 'open', checking: false });
      setSlotsLoading(true);

      // Build params for /api/booking/slots endpoint which calls RPC:
      // get_available_slots(p_business_id, p_store_id, p_staff_id, p_service_duration, p_date, p_days_ahead)
      const params = new URLSearchParams({
        business_id: config.business.id,
        service_id: selectedService.id,
        date: startDateStr, // Pass the start date to backend
        _t: Date.now().toString(), // Cache buster
      });

      // ALWAYS pass store_id when a store is selected (required for proper filtering)
      if (selectedStore) {
        params.set('store_id', selectedStore.id);
      }

      if (selectedStaff) {
        params.set('staff_id', selectedStaff.id);
      }

      const requestUrl = `${backendUrl}/api/booking/slots?${params}`;
      const requestParams = {
        business_id: config.business.id,
        store_id: selectedStore?.id || null,
        staff_id: selectedStaff?.id || null,
        service_id: selectedService.id,
        date: params.get('date') || null,
      };

      console.log('[Booking] Fetching slots:', requestParams);

      try {
        const response = await fetch(requestUrl, {
          cache: 'no-store', // Ensure no caching
        });

        const result = await response.json();

        if (response.ok) {
          console.log('[Booking] Received slots:', {
            store_id: selectedStore?.id || 'none',
            days_with_slots: result.data?.length || 0,
          });
          setAvailableSlots(result.data || []);

          // Capture debug info on success
          const days = result.data || [];
          const totalSlots = days.reduce((sum: number, day: DaySlots) => sum + (day.slots?.length || 0), 0);
          setDebugInfo({
            requestParams,
            requestUrl,
            rawResponse: result,
            responseError: null,
            daysCount: days.length,
            totalSlots,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Capture error response
          setDebugInfo({
            requestParams,
            requestUrl,
            rawResponse: result,
            responseError: {
              message: result.error || `HTTP ${response.status}`,
              payload: result,
            },
            daysCount: 0,
            totalSlots: 0,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[Booking] Slots error:', err);
        // Capture exception
        const error = err instanceof Error ? err : new Error(String(err));
        setDebugInfo({
          requestParams,
          requestUrl,
          rawResponse: null,
          responseError: {
            message: error.message,
            stack: error.stack,
          },
          daysCount: 0,
          totalSlots: 0,
          timestamp: new Date().toISOString(),
        });
      } finally {
        console.log('[Booking] loadSlotsWithClosureCheck FINALLY: setSlotsLoading(false)');
        setSlotsLoading(false);
      }
    }

    loadSlotsWithClosureCheck();
  }, [config, selectedService, selectedStore, selectedStaff, backendUrl, isClosedDay]);

  // ============================================
  // Handle booking submission
  // ============================================

  const validateForm = useCallback(async (): Promise<boolean> => {
    const errors: Record<string, string> = {};

    if (!customerName.trim()) {
      errors.name = t('nameRequired');
    }

    if (!customerEmail.trim()) {
      errors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.email = t('emailInvalid');
    }

    // If basic validation passes, check for duplicates on the server
    if (Object.keys(errors).length === 0 && config?.business?.id) {
      try {
        const checkRes = await fetch(`${backendUrl}/api/booking/check-duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: config.business.id,
            email: customerEmail.trim() || null,
            phone: customerPhone.trim() || null,
          }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.emailExists) {
            errors.email = t('duplicateEmail');
          }
          if (checkData.phoneExists) {
            errors.phone = t('duplicatePhone');
          }
        }
      } catch {
        // Duplicate check is best-effort; don't block submission on network error
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customerName, customerEmail, customerPhone, config, backendUrl, t]);

  const handleSubmitBooking = useCallback(async () => {
    if (!config || !selectedService || !selectedSlot) return;

    if (!await validateForm()) return;

    setBookingLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: config.business.id,
          store_id: selectedStore?.id || null,
          service_id: selectedService.id,
          staff_id: selectedStaff?.id || null,
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim().toLowerCase(),
          customer_phone: customerPhone.trim() || null,
          customer_notes: customerNotes.trim() || null,
          start_at: selectedSlot.start_utc || selectedSlot.start,
          duration_minutes: selectedService.duration_minutes,
          locale,
        }),
      });

      const result = await response.json();

      // Log the booking result for debugging
      console.log('[Booking] API Response:', {
        ok: response.ok,
        status: response.status,
        appointment_id: result.data?.id || result.data?.appointment_id,
        client_id: result.data?.client_id,
        confirmation_code: result.data?.confirmation_code,
        customer_name: result.data?.customer_name,
        start_at: result.data?.start_at,
        error: result.error || null,
      });

      if (!response.ok || result.error) {
        // Handle slot unavailable error - redirect to time selection
        if (result.code === 'SLOT_UNAVAILABLE' || result.redirect_to === 'datetime') {
          console.log('[Booking] Slot no longer available - redirecting to datetime step');
          setFormErrors({ submit: t('slotUnavailable') });
          // Clear selected slot and refresh availability
          setSelectedSlot(null);
          setAvailableSlots([]);
          // Navigate back to datetime step after a short delay
          setTimeout(() => {
            setStep('datetime');
            setFormErrors({});
          }, 2000);
          return;
        }
        setFormErrors({ submit: result.error || t('bookingError') });
        return;
      }

      setBookingResult(result.data);
      // Show success overlay first
      setShowSuccessOverlay(true);
      // After 2 seconds, hide overlay and go to success step
      setTimeout(() => {
        setShowSuccessOverlay(false);
        setStep('success');
      }, 2000);
    } catch (err) {
      console.error('[Booking] Submit error:', err);
      setFormErrors({ submit: t('bookingError') });
    } finally {
      setBookingLoading(false);
    }
  }, [config, selectedStore, selectedService, selectedStaff, selectedSlot, customerName, customerEmail, customerPhone, customerNotes, locale, validateForm, t, backendUrl, setStep]);

  // ============================================
  // Navigation helpers
  // ============================================

  const goToStep = useCallback((newStep: BookingStep) => {
    setStep(newStep);
    // NOTE: Do NOT call window.history.replaceState here — same issue as locale switching:
    // Expo Router on web patches replaceState and treats any call as a navigation event,
    // which can remount the component, reset loading=true, and erase booking progress.
    // Step is tracked in React state only; no URL sync needed for this flow.
  }, []);

  // Check if a store is closed today (via override, blackout, or regular hours)
  // PRIMARY: Uses backend-driven effectiveHoursMap (single source of truth)
  // FALLBACK: Local calculation if backend data not loaded yet
  const isStoreClosedToday = useCallback((store: { id: string; hours?: StoreHoursDay[]; blackout_dates?: string[] }): boolean => {
    // PRIMARY: Use backend-driven effective hours (single source of truth)
    const backendHours = effectiveHoursMap[store.id];
    if (backendHours) {
      console.log(`[isStoreClosedToday] Store ${store.id}: Using backend (source: ${backendHours.source}, is_closed: ${backendHours.is_closed})`);
      return backendHours.is_closed;
    }

    // FALLBACK: Local calculation (only used if backend hasn't responded yet)
    console.log(`[isStoreClosedToday] Store ${store.id}: Backend not loaded, using fallback`);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0] as string; // YYYY-MM-DD
    const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday

    // FIRST: Check for store_hours_overrides for today
    const overrides = config?.store_hours_overrides || [];
    const todayOverride = overrides.find(o =>
      o.store_id === store.id &&
      todayStr >= o.start_date &&
      todayStr <= o.end_date
    );

    if (todayOverride) {
      return todayOverride.is_closed;
    }

    // SECOND: Check blackout_dates
    if (store.blackout_dates && store.blackout_dates.includes(todayStr)) {
      return true;
    }

    // THIRD: Check regular weekly hours
    const hours = store.hours;
    if (!hours || hours.length === 0) return false;
    const todayHours = hours.find(h => h.day_of_week === dayOfWeek);
    if (!todayHours) return false;
    return todayHours.is_closed;
  }, [config?.store_hours_overrides, effectiveHoursMap]);

  // Check if store is closed due to blackout dates specifically (not regular hours)
  // Used to show friendly "store is closed today" message vs generic "no slots"
  // Checks if TODAY (the start of the booking period) is a blackout date
  const isStoreClosedDueToBlackout = useCallback((store: { id: string; blackout_dates?: string[] } | null): boolean => {
    if (!store) return false;

    // PRIMARY: Check backend effective hours source for today
    const backendHours = effectiveHoursMap[store.id];
    if (backendHours && backendHours.source === 'blackout' && backendHours.is_closed) {
      return true;
    }

    // FALLBACK: Check if today is in blackout_dates
    // The booking slots are fetched starting from today, so if today is a blackout
    // and no slots are returned, show the friendly closed message
    if (store.blackout_dates && store.blackout_dates.length > 0) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0] as string;
      if (store.blackout_dates.includes(todayStr)) {
        return true;
      }
    }

    return false;
  }, [effectiveHoursMap]);


  const handleSelectStore = useCallback((store: BookingConfig['stores'][0]) => {
    setSelectedStore(store);
    setSelectedService(null);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]); // Clear slots when store changes to prevent stale data

    // Check if this store is closed today
    const closedToday = isStoreClosedToday(store);
    setStoreClosedToday(closedToday);

    goToStep('service');
  }, [goToStep, isStoreClosedToday]);

  const handleSelectService = useCallback((service: BookingConfig['services'][0]) => {
    setSelectedService(service);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]); // Clear slots to force fresh fetch

    // Filter staff by selected store and service
    // Staff MUST be assigned to the selected store
    const availableStaff = config?.staff.filter((staff) => {
      // Filter by store - staff MUST be assigned to selected store
      const matchesStore = !selectedStore || (staff.store_ids && staff.store_ids.length > 0 && staff.store_ids.includes(selectedStore.id));
      // Filter by service (staff must have this service in their service_ids)
      const matchesService = !staff.service_ids || staff.service_ids.length === 0 || staff.service_ids.includes(service.id);
      return matchesStore && matchesService;
    }) || [];

    // If business has staff, show staff selection (staff selection is required)
    if (config?.staff && config.staff.length > 0) {
      goToStep('staff');
    } else {
      goToStep('datetime');
    }
  }, [config, selectedStore, goToStep]);

  const handleSelectStaff = useCallback((staff: BookingConfig['staff'][0]) => {
    setSelectedStaff(staff);
    setSelectedDate(null);
    setSelectedSlot(null);
    setAvailableSlots([]); // Clear slots to force fresh fetch
    goToStep('datetime');
  }, [goToStep]);

  const handleSelectSlot = useCallback((date: string, slot: TimeSlot) => {
    setSelectedDate(date);
    setSelectedSlot(slot);
    goToStep('details');
  }, [goToStep]);

  const handleDetailsSubmit = useCallback(async () => {
    if (await validateForm()) {
      goToStep('confirm');
    }
  }, [validateForm, goToStep]);

  // ============================================
  // Format helpers
  // ============================================

  const formatPrice = useCallback((cents: number) => {
    if (cents === 0) return t('free');
    return `$${(cents / 100).toFixed(2)}`;
  }, [t]);

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return t('today');
    if (date.toDateString() === tomorrow.toDateString()) return t('tomorrow');

    return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  }, [locale, t]);

  const formatTime = useCallback((isoString: string) => {
    // Slots from the backend are wall-clock strings (no timezone offset), e.g. "2026-02-25T10:00:00".
    // Parsing them through `new Date()` would apply the device's local timezone and shift the time.
    // Instead, extract HH:MM directly and format to 12h display.
    if (!isoString) return '';
    const timePart = isoString.includes('T') ? isoString.split('T')[1] : isoString;
    const [hourStr, minuteStr] = (timePart ?? '').split(':');
    const hour = parseInt(hourStr ?? '0', 10);
    const minute = minuteStr ?? '00';
    if (isNaN(hour)) {
      // Fallback for actual UTC ISO strings with offset (confirmation screen)
      return new Date(isoString).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    }
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h12}:${minute} ${ampm}`;
  }, [locale]);

  // Format phone number for display (US format: (XXX) XXX-XXXX if 10 digits)
  const formatPhoneDisplay = useCallback((phone: string): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }, []);

  // Format phone number while typing — US: (XXX) XXX-XXXX for 10 digits
  const handlePhoneChange = useCallback((value: string): void => {
    // Check if user is typing an international number (starts with +)
    const startsWithPlus = value.startsWith('+');

    // Remove all non-numeric characters except leading +
    const digitsOnly = value.replace(/\D/g, '');

    // If starts with + or has more than 10 digits (or 11 starting with 1), treat as international
    if (startsWithPlus || digitsOnly.length > 10) {
      // For international: keep + prefix and digits only, no formatting
      const prefix = startsWithPlus ? '+' : '';
      setCustomerPhone(prefix + digitsOnly);
      return;
    }

    // US format: (XXX) XXX-XXXX for 10 digits
    let formatted = '';
    if (digitsOnly.length === 0) {
      formatted = '';
    } else if (digitsOnly.length <= 3) {
      formatted = `(${digitsOnly}`;
    } else if (digitsOnly.length <= 6) {
      formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
    } else {
      formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
    }

    setCustomerPhone(formatted);
  }, []);

  // Format store hours for today (e.g., "Today: 9:00 AM - 5:00 PM" or "Closed today")
  // PRIMARY: Uses backend-driven effectiveHoursMap (single source of truth with override logic)
  // FALLBACK: Local calculation if backend data not loaded yet
  const formatTodayHours = useCallback((store: { id: string; hours?: StoreHoursDay[]; blackout_dates?: string[] }): string | null => {
    // PRIMARY: Use backend-driven effective hours (single source of truth)
    const backendHours = effectiveHoursMap[store.id];
    if (backendHours) {
      console.log(`[formatTodayHours] Store ${store.id}: Using backend hours (source: ${backendHours.source})`);
      return backendHours.formatted_hours;
    }

    // FALLBACK: Local calculation (only used if backend hasn't responded yet)
    console.log(`[formatTodayHours] Store ${store.id}: Backend hours not loaded, using fallback`);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0] as string; // YYYY-MM-DD
    const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday

    // Format time (HH:MM to readable)
    const formatHourTime = (time: string) => {
      const parts = time.split(':').map(Number);
      const h = parts[0] ?? 0;
      const m = parts[1] ?? 0;
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
    };

    // FIRST: Check for store_hours_overrides for today
    const overrides = config?.store_hours_overrides || [];
    const todayOverride = overrides.find(o =>
      o.store_id === store.id &&
      todayStr >= o.start_date &&
      todayStr <= o.end_date
    );

    if (todayOverride) {
      if (todayOverride.is_closed) {
        return 'Closed today';
      }
      if (todayOverride.open_time && todayOverride.close_time) {
        return `Today: ${formatHourTime(todayOverride.open_time)} - ${formatHourTime(todayOverride.close_time)}`;
      }
    }

    // SECOND: Check blackout_dates
    if (store.blackout_dates && store.blackout_dates.includes(todayStr)) {
      return 'Closed today';
    }

    // THIRD: Fall back to regular weekly hours
    const hours = store.hours;
    if (!hours || hours.length === 0) return null;
    const todayHours = hours.find(h => h.day_of_week === dayOfWeek);
    if (!todayHours) return null;
    if (todayHours.is_closed) return 'Closed today';

    return `Today: ${formatHourTime(todayHours.open_time)} - ${formatHourTime(todayHours.close_time)}`;
  }, [config?.store_hours_overrides, effectiveHoursMap]);

  // ============================================
  // Add to calendar - multiple options
  // ============================================

  const calendarLabels = useMemo(() => ({
    en: { addToCalendar: "Add to Calendar", google: "Google Calendar", apple: "Apple Calendar", outlook: "Outlook", downloadIcs: "Download .ics" },
    es: { addToCalendar: "Añadir al calendario", google: "Google Calendar", apple: "Apple Calendar", outlook: "Outlook", downloadIcs: "Descargar .ics" },
    fr: { addToCalendar: "Ajouter au calendrier", google: "Google Agenda", apple: "Apple Calendrier", outlook: "Outlook", downloadIcs: "Télécharger .ics" },
    de: { addToCalendar: "Zum Kalender hinzufügen", google: "Google Kalender", apple: "Apple Kalender", outlook: "Outlook", downloadIcs: ".ics herunterladen" },
    it: { addToCalendar: "Aggiungi al calendario", google: "Google Calendar", apple: "Apple Calendar", outlook: "Outlook", downloadIcs: "Scarica .ics" },
    pt: { addToCalendar: "Adicionar ao calendário", google: "Google Agenda", apple: "Apple Calendário", outlook: "Outlook", downloadIcs: "Baixar .ics" },
  }), []);

  const getCalendarLabel = useCallback((key: 'addToCalendar' | 'google' | 'apple' | 'outlook' | 'downloadIcs') => {
    const labels = calendarLabels[locale as keyof typeof calendarLabels] || calendarLabels.en;
    return labels[key];
  }, [locale, calendarLabels]);

  // Show calendar options modal
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);

  const handleAddToCalendar = useCallback((type: 'google' | 'outlook' | 'ics') => {
    if (!bookingResult || !config) return;

    const start = new Date(bookingResult.start_at);
    const end = new Date(bookingResult.end_at);
    const title = `${getLocalizedServiceName(selectedService?.name) || t('appointmentDetails')} at ${config.business.name}`;
    const details = `Confirmation: ${bookingResult.confirmation_code}`;

    if (type === 'google') {
      // Google Calendar URL
      const startStr = start.toISOString().replace(/-|:|\.\d{3}/g, '');
      const endStr = end.toISOString().replace(/-|:|\.\d{3}/g, '');
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}`;
      Linking.openURL(url);
    } else if (type === 'outlook') {
      // Outlook Web URL
      const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: title,
        body: details,
        startdt: bookingResult.start_at,
        enddt: bookingResult.end_at,
      });
      const url = `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
      Linking.openURL(url);
    } else if (type === 'ics') {
      // Download ICS file from backend
      const icsUrl = `${backendUrl}/calendar/booking/${bookingResult.confirmation_code}.ics`;
      Linking.openURL(icsUrl);
    }

    setShowCalendarOptions(false);
  }, [bookingResult, config, selectedService, backendUrl]);

  // ============================================
  // Change locale
  // ============================================

  const handleChangeLocale = useCallback((newLocale: Language) => {
    setLocale(newLocale);
    setShowLanguagePicker(false);

    // Save to localStorage for persistence
    // NOTE: Do NOT call window.history.replaceState here — Expo Router on web
    // detects that as a navigation event and remounts the component, which
    // resets loading=true and leaves the page stuck on the loading screen.
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(BOOKING_LANG_KEY, newLocale);
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }, []);

  // ============================================
  // Render loading state
  // ============================================

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color={brandColor} />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">{t('loading')}</Text>
      </View>
    );
  }

  // ============================================
  // Render error state
  // ============================================

  if (error || !config) {
    return (
      <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center p-6">
        <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
          <AlertCircle size={32} color="#EF4444" />
        </View>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t('pageNotFound')}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center">
          {t('invalidLink')}
        </Text>
      </View>
    );
  }

  // ============================================
  // Enabled locales for picker
  // ============================================

  const enabledLocales = config.booking_page_settings.enabled_locales
    .map((code) => AVAILABLE_BOOKING_LOCALES.find((l) => l.code === code))
    .filter(Boolean) as typeof AVAILABLE_BOOKING_LOCALES;

  // ============================================
  // Render main content
  // ============================================

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-gray-900"
      edges={['top', 'bottom']}
      style={Platform.OS === 'web' ? { height: '100vh' as unknown as number, overflow: 'hidden' } : undefined}
    >
      {/* Header - hidden on landing step for clean native look */}
      {step !== 'landing' && (
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          {step !== 'success' ? (
            <Pressable
              onPress={() => {
                const stepOrder: BookingStep[] = ['landing', 'store', 'service', 'staff', 'datetime', 'details', 'confirm'];
                const currentIndex = stepOrder.indexOf(step);
                if (currentIndex > 0) {
                  let prevStep = stepOrder[currentIndex - 1];
                  // Skip store step if only 1 or 0 stores
                  if (prevStep === 'store' && config.stores.length <= 1) {
                    prevStep = 'landing';
                  }
                  // Skip staff step if no staff for selected store/service
                  if (prevStep === 'staff') {
                    const filteredStaff = config.staff.filter((staff) => {
                      // Staff MUST be assigned to selected store
                      const matchesStore = !selectedStore || (staff.store_ids && staff.store_ids.length > 0 && staff.store_ids.includes(selectedStore.id));
                      const matchesService = !selectedService || !staff.service_ids || staff.service_ids.length === 0 || staff.service_ids.includes(selectedService.id);
                      return matchesStore && matchesService;
                    });
                    if (filteredStaff.length === 0) {
                      prevStep = 'service';
                    }
                  }
                  // Clear slots when going back to store or service selection to prevent stale data
                  if (prevStep === 'store' || prevStep === 'service' || prevStep === 'landing') {
                    setAvailableSlots([]);
                  }
                  goToStep(prevStep);
                }
              }}
              className="w-10 h-10 items-center justify-center"
            >
              <ChevronLeft size={24} color="#6B7280" />
            </Pressable>
          ) : (
            <View className="w-10" />
          )}

          <Text className="text-lg font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
            {config.business.name}
          </Text>

          {/* Language Picker - only show if more than 1 language enabled */}
          {enabledLocales.length > 1 ? (
            <Pressable
              onPress={() => setShowLanguagePicker(!showLanguagePicker)}
              className="w-10 h-10 items-center justify-center"
            >
              <Globe size={22} color="#6B7280" />
            </Pressable>
          ) : (
            <View className="w-10" />
          )}
        </View>
      )}

      {/* Language Picker Dropdown - only show if more than 1 language enabled */}
      {showLanguagePicker && enabledLocales.length > 1 && (
        <Pressable
          onPress={() => setShowLanguagePicker(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
        >
          <Animated.View
            entering={FadeIn.duration(150)}
            className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{
              minWidth: 180,
              top: step === 'landing' ? 120 : 60,
              left: '50%',
              transform: [{ translateX: -90 }],
            }}
          >
            {enabledLocales.map((loc) => (
              <Pressable
                key={loc.code}
                onPress={() => handleChangeLocale(loc.code)}
                className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700"
                style={locale === loc.code ? { backgroundColor: brandColorLight } : undefined}
              >
                <Text
                  className="flex-1"
                  style={locale === loc.code ? { color: brandColor, fontWeight: '600' } : { color: '#374151' }}
                >
                  {loc.nativeName}
                </Text>
                {locale === loc.code && <Check size={18} color={brandColor} />}
              </Pressable>
            ))}
          </Animated.View>
        </Pressable>
      )}

      {/* Landing Step — Sticky location/identity header (never scrolls away) */}
      {step === 'landing' && (
        <Animated.View
          entering={FadeInDown.delay(80)}
          style={{
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 20,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          }}
        >
          {/* Logo or Calendar Icon */}
          {logoUrl ? (
            <View style={{ marginBottom: 20, backgroundColor: 'transparent', alignItems: 'center' }}>
              <Image
                source={{ uri: logoUrl }}
                style={{ width: 120, height: 120, backgroundColor: 'transparent' }}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: brandColorLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Calendar size={44} color={brandColor} />
            </View>
          )}
          <Text
            style={{ fontSize: 22, fontWeight: '700', color: isDark ? '#fff' : '#111827', textAlign: 'center', marginBottom: 6 }}
          >
            {t('bookAppointment')}
          </Text>
          <Text
            style={{ fontSize: 16, color: isDark ? '#D1D5DB' : '#4B5563', textAlign: 'center', fontWeight: '500' }}
          >
            {config.business.name}
          </Text>
          {/* Address / phone / hours — single-store only */}
          {config.stores.length <= 1 && (() => {
            const displayAddress = config.stores.length === 1 ? config.stores[0]?.address : config.business.address;
            const displayPhone = config.stores.length === 1 ? config.stores[0]?.phone : config.business.phone;
            const singleStore = config.stores.length === 1 ? config.stores[0] : null;
            const storeEffectiveHours = singleStore ? effectiveHoursMap[singleStore.id] : null;
            const displayHours = storeEffectiveHours?.formatted_hours || (singleStore ? formatTodayHours(singleStore) : null);
            const isClosed = storeEffectiveHours?.is_closed ?? (singleStore ? isStoreClosedToday(singleStore) : false);
            if (!displayAddress && !displayPhone && !displayHours) return null;
            return (
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                {displayAddress && (
                  <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                    {displayAddress}
                  </Text>
                )}
                {displayPhone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Phone size={12} color="#9CA3AF" />
                    <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 13, marginLeft: 5 }}>
                      {formatPhoneDisplay(displayPhone)}
                    </Text>
                  </View>
                )}
                {displayHours && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Clock size={12} color={isClosed ? '#EF4444' : '#9CA3AF'} />
                    <Text style={{ color: isClosed ? '#EF4444' : (isDark ? '#9CA3AF' : '#6B7280'), fontSize: 13, marginLeft: 5 }}>
                      {displayHours}
                    </Text>
                    {storeEffectiveHours?.source && (
                      <Text style={{ color: isDark ? '#4B5563' : '#D1D5DB', fontSize: 11, marginLeft: 8 }}>
                        ({storeEffectiveHours.source === 'override' ? 'special hours' : storeEffectiveHours.source})
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })()}
        </Animated.View>
      )}

      {/* Main Content — scrollable form area */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
      >
        {/* Landing Step — action area only (header is pinned above) */}
        {step === 'landing' && (
          <Animated.View entering={FadeInDown.delay(140)} style={{ paddingHorizontal: 24, paddingTop: 28 }}>

            <Pressable
              onPress={() => {
                // If 2+ stores, ALWAYS go to store selection first
                if (config.stores.length > 1) {
                  goToStep('store');
                } else {
                  // Auto-select single store if exists and check if closed
                  if (config.stores.length === 1) {
                    const store = config.stores[0];
                    setSelectedStore(store);
                    setStoreClosedToday(isStoreClosedToday(store));
                  }
                  goToStep('service');
                }
              }}
              className="rounded-xl py-4 px-6 flex-row items-center justify-center"
              style={{ backgroundColor: brandColor }}
            >
              <Text className="text-white font-semibold text-lg mr-2">{t('continue')}</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </Pressable>

            {/* Language Picker on Landing - only show if more than 1 language enabled */}
            {enabledLocales.length > 1 && (
              <Pressable
                onPress={() => setShowLanguagePicker(!showLanguagePicker)}
                className="flex-row items-center justify-center mt-4 rounded-xl py-3.5 border-2"
                style={{ borderColor: brandColor }}
              >
                <Globe size={18} color={brandColor} />
                <Text className="font-semibold text-sm ml-2" style={{ color: brandColor }}>
                  {enabledLocales.find((l) => l.code === locale)?.nativeName || locale}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Store Selection Step */}
        {step === 'store' && (
          <View className="px-4 pt-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-2">
              {t('selectStore')}
            </Text>

            {config.stores.length === 0 ? (
              <View className="items-center py-12">
                <Briefcase size={48} color="#9CA3AF" />
                <Text className="text-gray-500 dark:text-gray-400 mt-4">{t('noStores')}</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {config.stores.map((store, index) => {
                  const todayHours = formatTodayHours(store);
                  return (
                    <Animated.View key={store.id} entering={FadeInUp.delay(index * 50)}>
                      <Pressable
                        onPress={() => handleSelectStore(store)}
                        className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4"
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <StorePhotoThumb
                            photoUrl={store.photo_thumb_url || store.photo_url}
                            brandColor={brandColor}
                            brandColorLight={brandColorLight}
                            storeId={store.id}
                          />
                          <View style={{ flex: 1, paddingTop: 2 }}>
                            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                              {store.name}
                            </Text>
                            {/* Store Address — full, no truncation */}
                            {store.address && (
                              <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                                {store.address}
                              </Text>
                            )}
                            {/* Store Phone */}
                            {store.phone && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Phone size={12} color="#6B7280" />
                                <Text className="text-gray-500 dark:text-gray-400 text-sm" style={{ marginLeft: 4 }}>
                                  {formatPhoneDisplay(store.phone)}
                                </Text>
                              </View>
                            )}
                            {/* Today's Hours */}
                            {todayHours && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Clock size={12} color="#6B7280" />
                                <Text className="text-gray-500 dark:text-gray-400 text-sm" style={{ marginLeft: 4 }}>
                                  {todayHours}
                                </Text>
                              </View>
                            )}
                          </View>
                          <ChevronRight size={24} color="#9CA3AF" style={{ marginTop: 2 }} />
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Service Selection Step */}
        {step === 'service' && (
          <Animated.View entering={FadeInDown.delay(100)} className="px-4 pt-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-2">
              {t('selectService')}
            </Text>

            {/* Show closed message if store is closed today via override */}
            {storeClosedToday ? (
              <View className="items-center py-12">
                <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
                  <AlertCircle size={32} color="#EF4444" />
                </View>
                <Text className="text-gray-700 dark:text-gray-300 text-center font-medium">
                  {t('storeClosed')}
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 text-sm mt-2 text-center">
                  {t('noSlotsDesc')}
                </Text>
              </View>
            ) : config.services.length === 0 ? (
              <View className="items-center py-12">
                <Briefcase size={48} color="#9CA3AF" />
                <Text className="text-gray-500 dark:text-gray-400 mt-4">{t('noServices')}</Text>
              </View>
            ) : (
              <View className="space-y-3">
                {config.services.map((service, index) => (
                  <Animated.View key={service.id} entering={FadeInUp.delay(index * 50)}>
                    <Pressable
                      onPress={() => handleSelectService(service)}
                      className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border-2 border-transparent"
                      style={{ borderLeftColor: brandColor, borderLeftWidth: 4 }}
                    >
                      <View className="flex-row items-center">
                        {/* Service icon — deterministic by service name, uses brand theme color */}
                        {(() => {
                          const ServiceIcon = getServiceIcon(service.name);
                          return (
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                backgroundColor: brandColor,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                                flexShrink: 0,
                              }}
                            >
                              <ServiceIcon size={22} color="#FFFFFF" />
                            </View>
                          );
                        })()}
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className="text-base font-semibold text-gray-900 dark:text-white flex-1">
                              {getLocalizedServiceName(service.name)}
                            </Text>
                            {/* Info indicator - only show if description exists */}
                            {service.description && (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setViewingServiceDescription({
                                    name: getLocalizedServiceName(service.name),
                                    description: service.description || '',
                                  });
                                  setShowServiceDescriptionModal(true);
                                }}
                                className="ml-2 p-1.5 rounded-full"
                                style={{ backgroundColor: `${brandColor}15` }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Info size={16} color={brandColor} />
                              </Pressable>
                            )}
                          </View>
                          <View className="flex-row items-center mt-1 space-x-4">
                            <View className="flex-row items-center">
                              <Clock size={13} color="#6B7280" />
                              <Text className="text-gray-500 dark:text-gray-400 text-sm ml-1">
                                {service.duration_minutes} {t('minutes')}
                              </Text>
                            </View>
                            {service.price_cents > 0 && (
                              <Text style={{ color: brandColor, fontWeight: '600', fontSize: 14 }}>
                                {formatPrice(service.price_cents)}
                              </Text>
                            )}
                          </View>
                        </View>
                        <ChevronRight size={22} color="#9CA3AF" />
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* Staff Selection Step */}
        {step === 'staff' && (() => {
          // Filter staff by selected store and service
          // Staff MUST be assigned to the selected store (not shown if no store assignments)
          const filteredStaff = config.staff.filter((staff) => {
            // Filter by store - staff MUST be assigned to selected store
            // If selectedStore exists, only show staff explicitly assigned to it
            const matchesStore = !selectedStore || (staff.store_ids && staff.store_ids.length > 0 && staff.store_ids.includes(selectedStore.id));
            // Filter by service (staff must have this service in their service_ids, or have no service restrictions)
            const matchesService = !selectedService || !staff.service_ids || staff.service_ids.length === 0 || staff.service_ids.includes(selectedService.id);
            return matchesStore && matchesService;
          });

          return (
            <Animated.View entering={FadeInDown.delay(100)} className="px-4 pt-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-2">
                {t('selectStaff')}
              </Text>

              <View className="space-y-3">
                {/* Info message when no specific staff match the filters */}
                {filteredStaff.length === 0 && (
                  <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mt-2">
                    <View className="flex-row items-start">
                      <AlertCircle size={20} color="#F59E0B" style={{ marginTop: 2 }} />
                      <View className="flex-1 ml-3">
                        <Text className="text-amber-800 dark:text-amber-200 font-medium">
                          {t('noStaffForService')}
                        </Text>
                        <Text className="text-amber-600 dark:text-amber-300 text-sm mt-1">
                          {t('noStaffForServiceDesc')}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Staff Members - filtered by store and service */}
                {filteredStaff.map((staff, index) => {
                  // Use thumbnail for faster loading
                  const avatarUrl = staff.avatar_thumb_url || staff.avatar_url;
                  return (
                    <Animated.View key={staff.id} entering={FadeInUp.delay((index + 1) * 50)}>
                      <Pressable
                        onPress={() => handleSelectStaff(staff)}
                        className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex-row items-center"
                      >
                        <View
                          className="w-12 h-12 rounded-full items-center justify-center mr-4 overflow-hidden"
                          style={{ backgroundColor: avatarUrl ? 'transparent' : staff.color + '30' }}
                        >
                          {avatarUrl ? (
                            <Image
                              source={{ uri: avatarUrl }}
                              style={{ width: 48, height: 48, borderRadius: 24 }}
                            />
                          ) : (
                            <Text className="text-lg font-bold" style={{ color: staff.color }}>
                              {staff.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text className="flex-1 text-lg font-medium text-gray-900 dark:text-white">
                          {staff.name}
                        </Text>
                        <ChevronRight size={24} color="#9CA3AF" />
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          );
        })()}

        {/* Date/Time Selection Step */}
        {step === 'datetime' && (
          <Animated.View entering={FadeInDown.delay(100)} className="px-4 pt-6">
            <Pressable
              onLongPress={() => {
                if (DEBUG_BOOKING) {
                  setShowDebugPanel(true);
                }
              }}
              delayLongPress={3000}
            >
              <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-2">
                {t('selectDateTime')}
              </Text>
            </Pressable>

            {/* Debug Panel - Long press on header to toggle */}
            {DEBUG_BOOKING && showDebugPanel && (
              <View className="mb-4 bg-gray-900 rounded-xl p-4 border border-gray-700">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-white font-bold text-lg">Debug Panel</Text>
                  <Pressable
                    onPress={() => setShowDebugPanel(false)}
                    className="bg-gray-700 rounded-full p-1"
                  >
                    <X size={20} color="#fff" />
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                  {/* App/Device Context */}
                  <Text className="text-yellow-400 font-semibold mb-1">App/Device Context:</Text>
                  <Text selectable className="text-gray-300 text-xs mb-2 font-mono">
                    now: {new Date().toISOString()}{'\n'}
                    timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}{'\n'}
                    selectedDate: {selectedDate || 'null'}
                  </Text>

                  {/* Request Context */}
                  <Text className="text-yellow-400 font-semibold mb-1 mt-2">Request Context:</Text>
                  <Text selectable className="text-gray-300 text-xs mb-2 font-mono">
                    URL: {debugInfo.requestUrl || 'N/A'}{'\n\n'}
                    Params:{'\n'}
                    {debugInfo.requestParams ? JSON.stringify(debugInfo.requestParams, null, 2) : 'N/A'}
                  </Text>

                  {/* Response Context */}
                  <Text className="text-yellow-400 font-semibold mb-1 mt-2">Response Context:</Text>
                  <Text selectable className="text-gray-300 text-xs mb-2 font-mono">
                    Days returned: {debugInfo.daysCount}{'\n'}
                    Total slots: {debugInfo.totalSlots}{'\n'}
                    Timestamp: {debugInfo.timestamp}{'\n\n'}
                    Raw Response:{'\n'}
                    {debugInfo.rawResponse ? JSON.stringify(debugInfo.rawResponse, null, 2) : 'N/A'}
                  </Text>

                  {/* Error Context */}
                  {debugInfo.responseError && (
                    <>
                      <Text className="text-red-400 font-semibold mb-1 mt-2">Error Context:</Text>
                      <Text selectable className="text-red-300 text-xs mb-2 font-mono">
                        Message: {debugInfo.responseError.message}{'\n'}
                        {debugInfo.responseError.stack ? `Stack: ${debugInfo.responseError.stack}\n` : ''}
                        {debugInfo.responseError.payload ? `Payload: ${JSON.stringify(debugInfo.responseError.payload, null, 2)}` : ''}
                      </Text>
                    </>
                  )}
                </ScrollView>

                {/* Copy Debug Info Button */}
                <Pressable
                  onPress={async () => {
                    const debugBlob = {
                      appContext: {
                        now: new Date().toISOString(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        selectedDate,
                      },
                      request: {
                        url: debugInfo.requestUrl,
                        params: debugInfo.requestParams,
                      },
                      response: {
                        daysCount: debugInfo.daysCount,
                        totalSlots: debugInfo.totalSlots,
                        timestamp: debugInfo.timestamp,
                        raw: debugInfo.rawResponse,
                      },
                      error: debugInfo.responseError,
                    };
                    await Clipboard.setStringAsync(JSON.stringify(debugBlob, null, 2));
                    setShowCopiedFeedback(true);
                    setTimeout(() => setShowCopiedFeedback(false), 2000);
                  }}
                  className="bg-blue-600 rounded-lg py-2 mt-3 flex-row items-center justify-center"
                >
                  <Copy size={16} color="#fff" />
                  <Text className="text-white font-semibold ml-2">Copy Debug Info</Text>
                </Pressable>
              </View>
            )}

            {/* PRIORITY 1: Store is CLOSED on starting date - show premium closed message immediately */}
            {/* This is determined by isClosedDay() BEFORE any API call - no loading, no flicker */}
            {dateClosureStatus.is_closed ? (
              <View className="items-center py-12 px-6">
                {/* Premium closed icon */}
                <View
                  className="w-20 h-20 rounded-full items-center justify-center mb-6"
                  style={{ backgroundColor: `${brandColor}15` }}
                >
                  <Clock size={40} color={brandColor} />
                </View>

                {/* Premium closed message - single localized key with full message */}
                <Text className="text-gray-700 dark:text-gray-300 text-center leading-6 text-base">
                  {t('bookingClosedSelectedDateMessage')}
                </Text>
              </View>
            ) : slotsLoading ? (
              /* PRIORITY 2: Loading slots - only show if store is confirmed OPEN */
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={brandColor} />
              </View>
            ) : availableSlots.length === 0 ? (
              /* PRIORITY 3: No slots available - check if it's because store is closed (fallback) */
              isStoreClosedDueToBlackout(selectedStore) || isClosedDay(new Date().toISOString().split('T')[0] as string, selectedStore) ? (
                // Store is closed (blackout/weekly) - show premium closed message (fallback path)
                <View className="items-center py-12 px-6">
                  <View
                    className="w-20 h-20 rounded-full items-center justify-center mb-6"
                    style={{ backgroundColor: `${brandColor}15` }}
                  >
                    <Clock size={40} color={brandColor} />
                  </View>
                  <Text className="text-gray-700 dark:text-gray-300 text-center leading-6 text-base">
                    {t('bookingClosedSelectedDateMessage')}
                  </Text>
                </View>
              ) : (
                // Store is OPEN but no availability (fully booked or no staff) - show "No available times"
                <View className="items-center py-12">
                  <Clock size={48} color="#9CA3AF" />
                  <Text className="text-gray-500 dark:text-gray-400 mt-4">{t('noSlots')}</Text>
                  <Text className="text-gray-400 dark:text-gray-500 text-sm mt-1">{t('noSlotsDesc')}</Text>
                </View>
              )
            ) : (
              <View className="space-y-6">
                {/* Display slots directly from get_available_slots() - no frontend filtering needed */}
                {/* The SQL function already handles: timezone, overrides, blackouts, past-time filtering */}
                {availableSlots.slice(0, 14).map((day) => {
                  // If this day has no slots, the SQL already excluded it
                  // No need to filter again - use slots as-is
                  if (!day.slots || day.slots.length === 0) return null;

                  return (
                    <View key={day.date}>
                      <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 px-2">
                        {formatDate(day.date)}
                      </Text>
                      <View className="flex-row flex-wrap">
                        {day.slots.map((slot, i) => (
                          <Pressable
                            key={`${day.date}-${i}`}
                            onPress={() => handleSelectSlot(day.date, slot)}
                            className="px-4 py-2 rounded-lg mr-2 mb-2 bg-gray-100 dark:bg-gray-800"
                            style={selectedSlot?.start === slot.start ? { backgroundColor: brandColor } : undefined}
                          >
                            <Text
                              className={
                                selectedSlot?.start === slot.start
                                  ? 'text-white font-semibold'
                                  : 'text-gray-700 dark:text-gray-300'
                              }
                            >
                              {formatTime(slot.start)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                }).filter(Boolean)}
              </View>
            )}
          </Animated.View>
        )}

        {/* Customer Details Step */}
        {step === 'details' && (
          <Animated.View entering={FadeInDown.delay(100)} className="px-4 pt-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-6 px-2">
              {t('yourDetails')}
            </Text>

            <View className="space-y-4">
              {/* Name */}
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 px-1">
                  {t('name')} *
                </Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4">
                  <User size={20} color="#6B7280" />
                  <TextInput
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder={t('namePlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 py-4 px-3 text-gray-900 dark:text-white"
                    autoCapitalize="words"
                  />
                </View>
                {formErrors.name && (
                  <Text className="text-red-500 text-sm mt-1 px-1">{formErrors.name}</Text>
                )}
              </View>

              {/* Email */}
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 px-1">
                  {t('email')} *
                </Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4">
                  <Mail size={20} color="#6B7280" />
                  <TextInput
                    value={customerEmail}
                    onChangeText={setCustomerEmail}
                    placeholder={t('emailPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 py-4 px-3 text-gray-900 dark:text-white"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {formErrors.email && (
                  <Text className="text-red-500 text-sm mt-1 px-1">{formErrors.email}</Text>
                )}
              </View>

              {/* Phone */}
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 px-1">
                  {t('phone')}
                </Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4">
                  <Phone size={20} color="#6B7280" />
                  <TextInput
                    value={customerPhone}
                    onChangeText={handlePhoneChange}
                    placeholder={t('phonePlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 py-4 px-3 text-gray-900 dark:text-white"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Notes */}
              <View>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 px-1">
                  {t('notes')}
                </Text>
                <View className="flex-row items-start bg-gray-100 dark:bg-gray-800 rounded-xl px-4 pt-4">
                  <MessageSquare size={20} color="#6B7280" />
                  <TextInput
                    value={customerNotes}
                    onChangeText={setCustomerNotes}
                    placeholder={t('notesPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 py-0 px-3 text-gray-900 dark:text-white min-h-[80px]"
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleDetailsSubmit}
              className="rounded-xl py-4 mt-6 flex-row items-center justify-center"
              style={{ backgroundColor: brandColor }}
            >
              <Text className="text-white font-semibold text-lg mr-2">{t('continue')}</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        )}

        {/* Review & Confirm Step */}
        {step === 'confirm' && (
          <Animated.View entering={FadeInDown.delay(100)} className="px-4 pt-6">
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-6 px-2">
              {t('reviewConfirm')}
            </Text>

            <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4">
              {/* Store/Location */}
              {selectedStore && (
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: brandColorLight }}
                  >
                    <Briefcase size={20} color={brandColor} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                      {t('location')}
                    </Text>
                    <Text className="text-gray-900 dark:text-white font-medium">
                      {selectedStore.name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Service */}
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: brandColorLight }}
                >
                  <Briefcase size={20} color={brandColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                    {t('service')}
                  </Text>
                  <Text className="text-gray-900 dark:text-white font-medium">
                    {getLocalizedServiceName(selectedService?.name)}
                  </Text>
                </View>
              </View>

              {/* Staff */}
              {selectedStaff && (
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: brandColorLight }}
                  >
                    <User size={20} color={brandColor} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                      {t('staffMember')}
                    </Text>
                    <Text className="text-gray-900 dark:text-white font-medium">
                      {selectedStaff.name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Date */}
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: brandColorLight }}
                >
                  <Calendar size={20} color={brandColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('date')}</Text>
                  <Text className="text-gray-900 dark:text-white font-medium">
                    {selectedDate && formatDate(selectedDate)}
                  </Text>
                </View>
              </View>

              {/* Time */}
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: brandColorLight }}
                >
                  <Clock size={20} color={brandColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('time')}</Text>
                  <Text className="text-gray-900 dark:text-white font-medium">
                    {selectedSlot && formatTime(selectedSlot.start)}
                  </Text>
                </View>
              </View>

              {/* Duration & Pricing Block */}
              <View className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-gray-500 dark:text-gray-400 text-sm">
                    {t('duration')}: {selectedService?.duration_minutes} {t('minutes')}
                  </Text>
                </View>
                {selectedService && selectedService.price_cents > 0 && (
                  <View className="mt-2">
                    {/* Service + unit price */}
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-700 dark:text-gray-300 text-sm">
                        {getLocalizedServiceName(selectedService.name)}
                      </Text>
                      <Text className="text-gray-700 dark:text-gray-300 text-sm">
                        {formatPrice(selectedService.price_cents)}
                      </Text>
                    </View>
                    {/* Total */}
                    <View className="flex-row items-center justify-between mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                      <Text className="font-semibold text-gray-900 dark:text-white">Total</Text>
                      <Text className="font-bold text-lg" style={{ color: brandColor }}>
                        {formatPrice(selectedService.price_cents)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Customer Info Summary */}
            <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mt-4">
              <Text className="text-gray-900 dark:text-white font-medium">{customerName}</Text>
              <Text className="text-gray-500 dark:text-gray-400">{customerEmail}</Text>
              {customerPhone && <Text className="text-gray-500 dark:text-gray-400">{customerPhone}</Text>}
            </View>

            {formErrors.submit && (
              <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mt-4 flex-row items-center">
                <AlertCircle size={20} color="#EF4444" />
                <Text className="text-red-600 dark:text-red-400 ml-2 flex-1">{formErrors.submit}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmitBooking}
              disabled={bookingLoading}
              className="rounded-xl py-4 mt-6 flex-row items-center justify-center"
              style={{ backgroundColor: bookingLoading ? '#9CA3AF' : brandColor }}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={20} color="#FFFFFF" />
                  <Text className="text-white font-semibold text-lg ml-2">{t('confirmBooking')}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}

        {/* Success Step */}
        {step === 'success' && bookingResult && (
          <Animated.View entering={FadeInDown.delay(100)} className="px-4 pt-8 items-center">
            <View className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 items-center justify-center mb-6">
              <Check size={40} color="#22C55E" />
            </View>

            <Text className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
              {t('appointmentConfirmedTitle')}
            </Text>

            <View className="bg-gray-100 dark:bg-gray-800 rounded-xl px-6 py-4 mt-4 w-full">
              <Text className="text-xs text-gray-500 dark:text-gray-400 uppercase text-center">
                {t('confirmationCode')}
              </Text>
              <Text className="text-2xl font-mono font-bold text-center mt-1" style={{ color: brandColor }}>
                {bookingResult.confirmation_code}
              </Text>
            </View>

            {/* Appointment Summary - Center aligned */}
            <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mt-6 w-full">
              <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 text-center">
                {t('appointmentDetails')}
              </Text>
              <View className="w-full items-center justify-center">
                <Text className="text-gray-900 dark:text-white text-lg font-semibold text-center w-full">
                  {getLocalizedServiceName(selectedService?.name)}
                </Text>
                <Text className="text-gray-600 dark:text-gray-300 text-center w-full mt-2">
                  {formatDate(bookingResult.start_at)} • {formatTime(bookingResult.start_at)}
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 text-center w-full mt-2">
                  {bookingResult.duration_minutes} {t('minutes')}
                </Text>
              </View>
            </View>

            {/* Calendar Options - Consistent Premium Buttons */}
            <View className="mt-6 w-full">
              <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 text-center">
                {getCalendarLabel('addToCalendar')}
              </Text>
              <View className="flex-row space-x-2">
                <Pressable
                  onPress={() => handleAddToCalendar('google')}
                  className="flex-1 rounded-xl py-3.5 items-center justify-center"
                  style={{ backgroundColor: brandColor }}
                >
                  <Text className="text-white font-semibold text-sm">{getCalendarLabel('google')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAddToCalendar('outlook')}
                  className="flex-1 rounded-xl py-3.5 items-center justify-center"
                  style={{ backgroundColor: brandColor }}
                >
                  <Text className="text-white font-semibold text-sm">{getCalendarLabel('outlook')}</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => handleAddToCalendar('ics')}
                className="rounded-xl py-3.5 mt-2 items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                <Text className="text-white font-semibold text-sm">
                  {getCalendarLabel('apple')} (.ics)
                </Text>
              </Pressable>
            </View>

            {/* Share and Download Actions */}
            <View className="mt-6 w-full flex-row space-x-3">
              <Pressable
                onPress={async () => {
                  const shareText = `${t('appointmentConfirmedTitle')}!\n\n${t('service')}: ${getLocalizedServiceName(selectedService?.name)}\n${t('date')}: ${formatDate(bookingResult.start_at)}\n${t('time')}: ${formatTime(bookingResult.start_at)}\n${t('confirmationCode')}: ${bookingResult.confirmation_code}\n\n${t('bookedWith')} ${config?.business?.name || ''}`;
                  if (Platform.OS === 'web') {
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: t('appointmentConfirmedTitle'), text: shareText });
                      } catch (e) {
                        await Clipboard.setStringAsync(shareText);
                        alert(t('copiedToClipboard'));
                      }
                    } else {
                      await Clipboard.setStringAsync(shareText);
                      alert(t('copiedToClipboard'));
                    }
                  } else {
                    try {
                      await Sharing.shareAsync('', { dialogTitle: t('shareBooking'), mimeType: 'text/plain' });
                    } catch {
                      await Clipboard.setStringAsync(shareText);
                    }
                  }
                }}
                className="flex-1 rounded-xl py-3.5 flex-row items-center justify-center border-2"
                style={{ borderColor: brandColor }}
              >
                <Share2 size={18} color={brandColor} />
                <Text className="font-semibold text-sm ml-2" style={{ color: brandColor }}>{t('shareBooking')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  // Open PDF confirmation page in browser
                  const pdfUrl = `${backendUrl}/api/booking/confirmation-pdf/${bookingResult.confirmation_code}`;
                  Linking.openURL(pdfUrl);
                }}
                className="flex-1 rounded-xl py-3.5 flex-row items-center justify-center border-2"
                style={{ borderColor: brandColor }}
              >
                <Download size={18} color={brandColor} />
                <Text className="font-semibold text-sm ml-2" style={{ color: brandColor }}>{t('download')}</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                // Reset and start over
                setStep('landing');
                setSelectedStore(null);
                setSelectedService(null);
                setSelectedStaff(null);
                setSelectedDate(null);
                setSelectedSlot(null);
                setAvailableSlots([]); // Clear slots to prevent stale data
                setCustomerName('');
                setCustomerEmail('');
                setCustomerPhone('');
                setCustomerNotes('');
                setBookingResult(null);
                setFormErrors({});
              }}
              className="mt-6"
            >
              <Text className="font-medium" style={{ color: brandColor }}>{t('bookAnother')}</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Premium Floating Bottom Action Bar - only show on landing, not during booking flow */}
      {step === 'landing' && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 50,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              borderRadius: 50,
              paddingHorizontal: 8,
              paddingVertical: 8,
              gap: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            {/* Share Button */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 50,
                backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
              })}
            >
              <Share2 size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
                Share
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />

            {/* Copy Link Button */}
            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 50,
                backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
              })}
            >
              {showCopiedFeedback ? (
                <>
                  <Check size={18} color="#22C55E" />
                  <Text style={{ color: '#22C55E', fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
                    Copied!
                  </Text>
                </>
              ) : (
                <>
                  <Copy size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
                    Copy Link
                  </Text>
                </>
              )}
            </Pressable>

            {/* Open in Browser - Web only */}
            {Platform.OS === 'web' && (
              <>
                <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <Pressable
                  onPress={handleOpenInBrowser}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 50,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                  })}
                >
                  <ExternalLink size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
                    Open
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      )}

      {/* Service Description Modal */}
      {showServiceDescriptionModal && viewingServiceDescription && (
        <Pressable
          onPress={() => setShowServiceDescriptionModal(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
            zIndex: 99,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 16,
              paddingBottom: 40,
              paddingHorizontal: 20,
              maxHeight: '60%',
            }}
          >
            {/* Handle bar */}
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: '#D1D5DB',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />
            {/* Close button */}
            <Pressable
              onPress={() => setShowServiceDescriptionModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                padding: 4,
              }}
            >
              <X size={24} color="#6B7280" />
            </Pressable>
            {/* Service name */}
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#111827',
                marginBottom: 12,
                paddingRight: 40,
              }}
            >
              {viewingServiceDescription.name}
            </Text>
            {/* Service description */}
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={{
                  fontSize: 16,
                  color: '#4B5563',
                  lineHeight: 24,
                }}
              >
                {viewingServiceDescription.description}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      )}

      {/* Success Overlay - same style as Log Visit */}
      {showSuccessOverlay && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: '#22C55E',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={60} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 20,
              fontWeight: '600',
              marginTop: 20,
            }}
          >
            {t('confirmed')}
          </Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

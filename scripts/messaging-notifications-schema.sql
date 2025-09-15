-- Create messages table for real-time messaging
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id text NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('admin', 'applicant')),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('status_update', 'document_request', 'approval', 'rejection', 'message', 'system')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  application_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Users can view their own messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can insert messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_application_id ON public.messages(application_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Function to automatically create notification when message is sent
CREATE OR REPLACE FUNCTION public.create_message_notification()
RETURNS trigger AS $$
BEGIN
  -- Create notification for recipient
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    application_id
  ) VALUES (
    NEW.recipient_id,
    'message',
    'New Message: ' || NEW.subject,
    'You have received a new message regarding application ' || NEW.application_id,
    NEW.application_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for message notifications
DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.create_message_notification();

-- Insert sample messages and notifications
INSERT INTO public.messages (
  application_id,
  sender_id,
  sender_type,
  recipient_id,
  subject,
  message,
  is_read,
  created_at
) VALUES 
(
  'PREME-2024-001',
  '550e8400-e29b-41d4-a716-446655440000',
  'admin',
  '550e8400-e29b-41d4-a716-446655440001',
  'Additional Documentation Required',
  'Please upload your most recent bank statements for review.',
  false,
  now() - interval '2 hours'
),
(
  'PREME-2024-001',
  '550e8400-e29b-41d4-a716-446655440001',
  'applicant',
  '550e8400-e29b-41d4-a716-446655440000',
  'Re: Additional Documentation Required',
  'Thank you for the update. I will upload the documents today.',
  true,
  now() - interval '1 hour'
) ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (
  user_id,
  type,
  title,
  message,
  application_id,
  is_read,
  created_at
) VALUES 
(
  '550e8400-e29b-41d4-a716-446655440001',
  'status_update',
  'Application Status Updated',
  'Your loan application PREME-2024-001 status has been updated to "Under Review"',
  'PREME-2024-001',
  false,
  now() - interval '3 hours'
),
(
  '550e8400-e29b-41d4-a716-446655440001',
  'document_request',
  'Documents Required',
  'Please upload additional documentation for your loan application',
  'PREME-2024-001',
  false,
  now() - interval '2 hours'
),
(
  '550e8400-e29b-41d4-a716-446655440001',
  'approval',
  'Loan Application Approved!',
  'Congratulations! Your loan application PREME-2024-002 has been approved.',
  'PREME-2024-002',
  true,
  now() - interval '1 day'
) ON CONFLICT DO NOTHING;

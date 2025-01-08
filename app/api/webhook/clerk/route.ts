/* eslint-disable camelcase */
// Resource: https://clerk.com/docs/users/sync-data-to-your-backend
// Above article shows why we need webhooks i.e., to sync data to our backend

// Resource: https://docs.svix.com/receiving/verifying-payloads/why
// It's a good practice to verify webhooks. Above article shows why we should do it
import { Webhook, WebhookRequiredHeaders } from "svix";
import { headers } from "next/headers";

import { IncomingHttpHeaders } from "http";

import { NextResponse } from "next/server";
import {
  addMemberToCommunity,
  createCommunity,
  deleteCommunity,
  removeUserFromCommunity,
  updateCommunityInfo,
} from "@/lib/actions/community.actions";

// Resource: https://clerk.com/docs/integration/webhooks#supported-events
// Above document lists the supported events
type EventType =
  | "organization.created"
  | "organizationInvitation.created"
  | "organizationMembership.created"
  | "organizationMembership.deleted"
  | "organization.updated"
  | "organization.deleted"
  | "user.created"
  | "user.updated"
  | "user.deleted";

type Event = {
  data: Record<string, string | number | Record<string, string>[]>;
  object: "event";
  type: EventType;
};

export async function POST(request: Request) {
  console.log('Webhook endpoint hit');
  
  try {
    // Get the headers
    const headerPayload = headers();
    
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing required headers');
      return NextResponse.json(
        { error: "Missing required headers" },
        { status: 400 }
      );
    }

    // Create the header object
    const heads = {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    };

    // Debug headers
    console.log('Received headers:', JSON.stringify(heads, null, 2));

    // Get the body
    const payload = await request.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));

    // Get the webhook secret
    const webhookSecret = process.env.NEXT_CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Missing NEXT_CLERK_WEBHOOK_SECRET');
      return NextResponse.json(
        { error: "Missing webhook secret" },
        { status: 500 }
      );
    }

    // Create webhook instance
    const wh = new Webhook(webhookSecret);
    
    // Verify the payload
    const evt = wh.verify(
      JSON.stringify(payload),
      heads as IncomingHttpHeaders & WebhookRequiredHeaders
    ) as Event;

    console.log('Event type:', evt.type);

    // Handle user events
    if (evt.type === "user.created") {
      console.log('User created:', evt.data);
      return NextResponse.json({ message: "User event received" }, { status: 200 });
    }

    // Handle organization events
    if (evt.type === "organization.created") {
      const { id, name, slug, logo_url, image_url, created_by } = evt.data ?? {};

      try {
        await createCommunity(
          id as string,
          name as string,
          slug as string,
          (logo_url as string) || (image_url as string),
          "org bio",
          created_by as string
        );

        return NextResponse.json({ message: "Organization created" }, { status: 201 });
      } catch (err) {
        console.error('Error creating community:', err);
        return NextResponse.json(
          { message: "Internal Server Error" },
          { status: 500 }
        );
      }
    }

    // ... rest of your event handlers ...

    return NextResponse.json({ message: "Webhook processed" }, { status: 200 });
    
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}

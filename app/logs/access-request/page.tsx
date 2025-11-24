"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, User, FileText } from "lucide-react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import {
  getAllPendingRequests,
  approveAccess,
  rejectAccess,
} from "@/lib/contracts";
import { useUserStore } from "@/stores/use-user";

interface AccessRequest {
  logId: number;
  requester: string;
  reason: string;
  requestedAt: number;
  logTitle?: string;
  logSeverity?: "HIGH" | "MEDIUM" | "LOW";
}

export default function AccessRequestsPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { role } = useUserStore();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load access requests from blockchain
  useEffect(() => {
    if (account) {
      loadAccessRequests();
    }
  }, [account]);

  const loadAccessRequests = async () => {
    try {
      setLoading(true);

      // Fetch pending requests from blockchain events
      const pendingRequests = await getAllPendingRequests(client);

      // Map to UI format with severity mapping
      const mappedRequests: AccessRequest[] = pendingRequests.map((req) => ({
        logId: req.logId,
        requester: req.requester,
        reason: req.reason,
        requestedAt: req.requestedAt * 1000, // Convert to milliseconds
        logTitle: `Log #${req.logId}`,
        logSeverity: "HIGH", // Default, could fetch from log details
      }));

      setRequests(mappedRequests);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast.error("Error", {
        description: "Failed to load access requests. Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: AccessRequest) => {
    try {
      setProcessingId(`${request.logId}-${request.requester}-approve`);

      // Call blockchain function
      await approveAccess(signAndExecute, request.logId, request.requester);

      toast.success("Access Approved", {
        description: `Access granted to ${request.requester.slice(0, 8)}...`,
      });

      // Remove from list
      setRequests(
        requests.filter(
          (r) =>
            !(r.logId === request.logId && r.requester === request.requester)
        )
      );
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Error", {
        description: "Failed to approve access request",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: AccessRequest) => {
    try {
      setProcessingId(`${request.logId}-${request.requester}-reject`);

      // Call blockchain function with reason
      await rejectAccess(
        signAndExecute,
        request.logId,
        request.requester,
        "Access denied by administrator"
      );

      toast.error("Access Rejected", {
        description: `Access denied for ${request.requester.slice(0, 8)}...`,
      });

      // Remove from list
      setRequests(
        requests.filter(
          (r) =>
            !(r.logId === request.logId && r.requester === request.requester)
        )
      );
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Error", {
        description: "Failed to reject access request",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-100 text-red-800 border-red-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "LOW":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (!account) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
            <p className="text-muted-foreground">
              Please connect your wallet to view access requests
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You do not have permission to view access requests
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Access Requests</h1>
        <p className="text-muted-foreground">
          Review and manage auditor access requests to compliance logs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Pending Requests
                </p>
                <p className="text-2xl font-bold">{requests.length}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Pending Requests</h3>
            <p className="text-muted-foreground">
              All access requests have been processed
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={`${request.logId}-${request.requester}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">
                        {request.logTitle || `Log #${request.logId}`}
                      </CardTitle>
                      {request.logSeverity && (
                        <Badge
                          variant="outline"
                          className={getSeverityColor(request.logSeverity)}
                        >
                          {request.logSeverity}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {request.requester}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(request)}
                      disabled={processingId !== null}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(request)}
                      disabled={processingId !== null}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-md">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Request Reason:</p>
                    <p className="text-sm text-muted-foreground">
                      {request.reason}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

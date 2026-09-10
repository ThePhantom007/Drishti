classdef ReduceMeanLayer1005 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net.coder.ReduceMeanLayer1005(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net.ReduceMeanLayer1005(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1005(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_2__8'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_2__8] = predict(this, x_blocks_blocks_2__2__)
            if isdlarray(x_blocks_blocks_2__2__)
                x_blocks_blocks_2__2_ = stripdims(x_blocks_blocks_2__2__);
            else
                x_blocks_blocks_2__2_ = x_blocks_blocks_2__2__;
            end
            x_blocks_blocks_2__2NumDims = 4;
            x_blocks_blocks_2__2 = severity_net.coder.ops.permuteInputVar(x_blocks_blocks_2__2_, [4 3 1 2], 4);

            [x_blocks_blocks_2__8__, x_blocks_blocks_2__8NumDims__] = ReduceMeanGraph1015(this, x_blocks_blocks_2__2, x_blocks_blocks_2__2NumDims, false);
            x_blocks_blocks_2__8_ = severity_net.coder.ops.permuteOutputVar(x_blocks_blocks_2__8__, [3 4 2 1], 4);

            x_blocks_blocks_2__8 = dlarray(single(x_blocks_blocks_2__8_), 'SSCB');
        end

        function [x_blocks_blocks_2__8, x_blocks_blocks_2__8NumDims1017] = ReduceMeanGraph1015(this, x_blocks_blocks_2__2, x_blocks_blocks_2__2NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1010 = severity_net.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1016, coder.const(x_blocks_blocks_2__2NumDims));
            xReduced1011 = mean(x_blocks_blocks_2__2, dims1010);
            x_blocks_blocks_2__8 = xReduced1011;
            x_blocks_blocks_2__8NumDims = coder.const(x_blocks_blocks_2__2NumDims);

            % Set graph output arguments
            x_blocks_blocks_2__8NumDims1017 = coder.const(x_blocks_blocks_2__8NumDims);

        end

    end

end